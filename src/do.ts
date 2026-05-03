import { DurableObject } from 'cloudflare:workers'

export interface AccountState {
  rssUrl: string | null
  activeSessionId: string
  activeDeviceId: string
  activeEpisodeId: string
  activePositionSec: number
  activeState: 'playing' | 'paused' | 'ended'
  leaseUntil: number
}

export interface EpisodeProgress {
  episodeId: string
  positionSec: number
  durationSec?: number
  updatedAt: number
  lastSessionId: string
  state: 'playing' | 'paused' | 'ended'
}

interface Env {
  DB: D1Database
}

export class ProgressDO extends DurableObject {
  private account: AccountState | null = null
  private progress: Map<string, EpisodeProgress> = new Map()
  private initialized = false
  private req: Request

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  private getAccountId(): string {
    const url = new URL(this.req?.url || 'http://localhost')
    return url.searchParams.get('accountId') || this.ctx.id.name || ''
  }

  private async init() {
    if (this.initialized) return

    try {
      const url = new URL(this.req.url)
      const accountId = url.searchParams.get('accountId') || this.ctx.id.name

      const row = await this.env.DB.prepare(
        'SELECT * FROM accounts WHERE id = ?'
      ).bind(accountId).first<{
        id: string
        rss_url: string | null
        active_session_id: string
        active_device_id: string
        active_episode_id: string
        active_position_sec: number
        active_state: string
        lease_until: number
      }>()

      if (row) {
        this.account = {
          rssUrl: row.rss_url,
          activeSessionId: row.active_session_id,
          activeDeviceId: row.active_device_id,
          activeEpisodeId: row.active_episode_id,
          activePositionSec: row.active_position_sec,
          activeState: row.active_state as AccountState['activeState'],
          leaseUntil: row.lease_until,
        }

        const progressRows = await this.env.DB.prepare(
          'SELECT * FROM episode_progress WHERE account_id = ?'
        ).bind(accountId).all<{
          episode_id: string
          position_sec: number
          duration_sec: number | null
          state: string
          last_session_id: string
          updated_at: number
        }>()

        for (const p of progressRows.results || []) {
          this.progress.set(p.episode_id, {
            episodeId: p.episode_id,
            positionSec: p.position_sec,
            durationSec: p.duration_sec ?? undefined,
            state: p.state as EpisodeProgress['state'],
            lastSessionId: p.last_session_id,
            updatedAt: p.updated_at,
          })
        }
      }

      this.initialized = true
    } catch {
      // D1 not available in local dev, use in-memory state
    }
  }

  async fetch(req: Request): Promise<Response> {
    this.req = req
    await this.init()

    const url = new URL(req.url)
    const path = url.pathname

    if (req.method === 'GET' && path === '/do/state') {
      return this.handleState()
    }

    if (req.method === 'PATCH' && path === '/do/progress') {
      return this.handleProgress(req)
    }

    if (req.method === 'POST' && path === '/do/feed') {
      return this.handleFeed(req)
    }

    return new Response('Not Found', { status: 404 })
  }

  private handleState() {
    return new Response(
      JSON.stringify({
        account: this.account,
        progress: Object.fromEntries(this.progress),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private async handleFeed(req: Request): Promise<Response> {
    const body = await req.json<{ rssUrl: string }>()

    if (!this.account) {
      this.account = {
        rssUrl: null,
        activeSessionId: '',
        activeDeviceId: '',
        activeEpisodeId: '',
        activePositionSec: 0,
        activeState: 'paused',
        leaseUntil: 0,
      }
    }

    this.account.rssUrl = body.rssUrl || null
    await this.persist()

    return new Response(JSON.stringify({ rssUrl: this.account.rssUrl }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleProgress(req: Request): Promise<Response> {
    const body = await req.json<{
      sessionId: string
      deviceId: string
      episodeId: string
      positionSec: number
      durationSec?: number
      state: EpisodeProgress['state']
      takeover?: boolean
    }>()

    const now = Date.now()
    const LEASE_DURATION = 5 * 60 * 1000

    if (!this.account || now > this.account.leaseUntil) {
      this.setActive(body)
      return this.okResponse()
    }

    if (this.account.activeSessionId !== body.sessionId) {
      if (!body.takeover) {
        return new Response(
          JSON.stringify({
            error: 'conflict',
            activeSessionId: this.account.activeSessionId,
            activeDeviceId: this.account.activeDeviceId,
            leaseUntil: this.account.leaseUntil,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      this.setActive(body)
    } else {
      this.account.leaseUntil = now + LEASE_DURATION
    }

    this.progress.set(body.episodeId, {
      episodeId: body.episodeId,
      positionSec: body.positionSec,
      durationSec: body.durationSec,
      updatedAt: now,
      lastSessionId: body.sessionId,
      state: body.state,
    })

    await this.persist()
    return this.okResponse()
  }

  private setActive(body: {
    sessionId: string
    deviceId: string
    episodeId: string
    positionSec: number
    durationSec?: number
    state: EpisodeProgress['state']
  }) {
    const now = Date.now()
    const LEASE_DURATION = 5 * 60 * 1000

    if (!this.account) {
      this.account = {
        rssUrl: null,
        activeSessionId: '',
        activeDeviceId: '',
        activeEpisodeId: '',
        activePositionSec: 0,
        activeState: 'paused',
        leaseUntil: 0,
      }
    }

    this.account.activeSessionId = body.sessionId
    this.account.activeDeviceId = body.deviceId
    this.account.activeEpisodeId = body.episodeId
    this.account.activePositionSec = body.positionSec
    this.account.activeState = body.state
    this.account.leaseUntil = now + LEASE_DURATION

    this.progress.set(body.episodeId, {
      episodeId: body.episodeId,
      positionSec: body.positionSec,
      durationSec: body.durationSec,
      updatedAt: now,
      lastSessionId: body.sessionId,
      state: body.state,
    })
  }

  private async persist() {
    if (!this.account) return

    try {
      const accountId = this.getAccountId()
      if (!accountId) return

      await this.env.DB.prepare(
        `INSERT INTO accounts (id, rss_url, active_session_id, active_device_id, active_episode_id, active_position_sec, active_state, lease_until, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           rss_url = excluded.rss_url,
           active_session_id = excluded.active_session_id,
           active_device_id = excluded.active_device_id,
           active_episode_id = excluded.active_episode_id,
           active_position_sec = excluded.active_position_sec,
           active_state = excluded.active_state,
           lease_until = excluded.lease_until,
           updated_at = excluded.updated_at`
      ).bind(
        accountId,
        this.account.rssUrl,
        this.account.activeSessionId,
        this.account.activeDeviceId,
        this.account.activeEpisodeId,
        this.account.activePositionSec,
        this.account.activeState,
        this.account.leaseUntil,
        Date.now()
      ).run()

      for (const [_, p] of this.progress) {
        await this.env.DB.prepare(
          `INSERT INTO episode_progress (account_id, episode_id, position_sec, duration_sec, state, last_session_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(account_id, episode_id) DO UPDATE SET
             position_sec = excluded.position_sec,
             duration_sec = excluded.duration_sec,
             state = excluded.state,
             last_session_id = excluded.last_session_id,
             updated_at = excluded.updated_at`
        ).bind(
          accountId,
          p.episodeId,
          p.positionSec,
          p.durationSec ?? null,
          p.state,
          p.lastSessionId,
          p.updatedAt
        ).run()
      }
    } catch {
      // D1 not available in local dev, use in-memory state
    }
  }

  private okResponse() {
    return new Response(
      JSON.stringify({
        account: this.account
          ? {
              activeEpisodeId: this.account.activeEpisodeId,
              activePositionSec: this.account.activePositionSec,
              activeState: this.account.activeState,
              leaseUntil: this.account.leaseUntil,
            }
          : null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }
}