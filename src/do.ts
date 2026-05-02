import { DurableObject } from 'cloudflare:workers'

export interface AccountState {
  activeSessionId: string
  activeDeviceId: string
  activeEpisodeId: string
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

export interface Episode {
  id: string
  title: string
  audioUrl: string
  duration: number
}

interface Env {
  DB: D1Database
}

export class ProgressDO extends DurableObject {
  private account: AccountState | null = null
  private progress: Map<string, EpisodeProgress> = new Map()
  private episodes: Episode[] = []
  private initialized = false
  private req: Request

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  private async init() {
    if (this.initialized) return

    try {
      const url = new URL(this.req.url)
      const accountId = url.searchParams.get('accountId') || this.ctx.id.name
      console.log('init DO for account:', accountId)

      const row = await this.env.DB.prepare(
        'SELECT * FROM accounts WHERE id = ?'
      ).bind(accountId).first<{
        id: string
        active_session_id: string
        active_device_id: string
        active_episode_id: string
        lease_until: number
      }>()

    if (row) {
      this.account = {
        activeSessionId: row.active_session_id,
        activeDeviceId: row.active_device_id,
        activeEpisodeId: row.active_episode_id,
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

    if (req.method === 'POST' && path === '/do/transition') {
      return this.handleTransition(req)
    }

    if (req.method === 'POST' && path === '/do/takeover') {
      return this.handleTakeover(req)
    }

    if (req.method === 'GET' && path === '/do/episodes') {
      return this.handleGetEpisodes()
    }

    if (req.method === 'POST' && path === '/do/episodes') {
      return this.handleAddEpisodes(req)
    }

    return new Response('Not Found', { status: 404 })
  }

  private handleState() {
    if (!this.account) {
      return new Response(JSON.stringify({ account: null, progress: {} }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const activeProgress = this.account.activeEpisodeId
      ? this.progress.get(this.account.activeEpisodeId)
      : null

    return new Response(
      JSON.stringify({
        account: {
          activeEpisodeId: this.account.activeEpisodeId,
          positionSec: activeProgress?.positionSec || 0,
          deviceId: this.account.activeDeviceId,
          leaseUntil: this.account.leaseUntil,
        },
        progress: Object.fromEntries(this.progress),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
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

    // No active session or lease expired
    if (!this.account || now > this.account.leaseUntil) {
      this.setActive(body)
      return this.okResponse()
    }

    // Check session conflict
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
      // Same session, extend lease
      this.account.leaseUntil = now + LEASE_DURATION
    }

    // Update progress
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

  private async handleTransition(req: Request): Promise<Response> {
    const body = await req.json<{
      sessionId: string
      deviceId: string
      from: {
        episodeId: string
        positionSec: number
        state: EpisodeProgress['state']
      }
      to: {
        episodeId: string
        positionSec: number
        state: EpisodeProgress['state']
      }
      takeover?: boolean
    }>()

    const now = Date.now()
    const LEASE_DURATION = 5 * 60 * 1000

    if (!this.account || now > this.account.leaseUntil) {
      this.setActive({
        sessionId: body.sessionId,
        deviceId: body.deviceId,
        episodeId: body.to.episodeId,
        positionSec: body.to.positionSec,
        state: body.to.state,
      })
    } else if (this.account.activeSessionId !== body.sessionId) {
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
      this.setActive({
        sessionId: body.sessionId,
        deviceId: body.deviceId,
        episodeId: body.to.episodeId,
        positionSec: body.to.positionSec,
        state: body.to.state,
      })
    } else {
      this.account.leaseUntil = now + LEASE_DURATION
    }

    // Update from episode
    this.progress.set(body.from.episodeId, {
      episodeId: body.from.episodeId,
      positionSec: body.from.positionSec,
      updatedAt: now,
      lastSessionId: body.sessionId,
      state: body.from.state,
    })

    // Update to episode
    this.progress.set(body.to.episodeId, {
      episodeId: body.to.episodeId,
      positionSec: body.to.positionSec,
      updatedAt: now,
      lastSessionId: body.sessionId,
      state: body.to.state,
    })

    // Update active episode
    if (this.account) {
      this.account.activeEpisodeId = body.to.episodeId
    }

    await this.persist()
    return this.okResponse()
  }

  private async handleTakeover(req: Request): Promise<Response> {
    const body = await req.json<{
      sessionId: string
      deviceId: string
      episodeId: string
      positionSec: number
      state: EpisodeProgress['state']
    }>()

    this.setActive(body)
    await this.persist()
    return this.okResponse()
  }

  private setActive(body: {
    sessionId: string
    deviceId: string
    episodeId: string
    positionSec: number
    state: EpisodeProgress['state']
  }) {
    const now = Date.now()
    const LEASE_DURATION = 5 * 60 * 1000

    this.account = {
      activeSessionId: body.sessionId,
      activeDeviceId: body.deviceId,
      activeEpisodeId: body.episodeId,
      leaseUntil: now + LEASE_DURATION,
    }

    this.progress.set(body.episodeId, {
      episodeId: body.episodeId,
      positionSec: body.positionSec,
      updatedAt: now,
      lastSessionId: body.sessionId,
      state: body.state,
    })
  }

  private async persist() {
    if (!this.account) return

    const accountId = this.ctx.id.name

    await this.env.DB.prepare(
      `INSERT INTO accounts (id, active_session_id, active_device_id, active_episode_id, lease_until, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         active_session_id = excluded.active_session_id,
         active_device_id = excluded.active_device_id,
         active_episode_id = excluded.active_episode_id,
         lease_until = excluded.lease_until,
         updated_at = excluded.updated_at`
    ).bind(
      accountId,
      this.account.activeSessionId,
      this.account.activeDeviceId,
      this.account.activeEpisodeId,
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
  }

  private okResponse() {
    return new Response(
      JSON.stringify({
        account: this.account
          ? {
              activeEpisodeId: this.account.activeEpisodeId,
              leaseUntil: this.account.leaseUntil,
            }
          : null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private handleGetEpisodes() {
    return new Response(JSON.stringify({ episodes: this.episodes }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleAddEpisodes(req: Request) {
    const body = await req.json<{ episodes: Episode[] }>()
    this.episodes = [...this.episodes, ...body.episodes]
    await this.persist()
    return new Response(JSON.stringify({ episodes: this.episodes }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}