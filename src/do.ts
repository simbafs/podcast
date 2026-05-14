import { DurableObject } from 'cloudflare:workers'

export interface AccountState {
  rssUrl: string | null
  order: 'new-to-old' | 'old-to-new'
  activeSessionId: string
}

export interface EpisodeProgress {
  episodeId: string
  positionSec: number
  updatedAt: number
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
    const accountIdParam = url.searchParams.get('accountId')
    const accountParam = url.searchParams.get('account')
    const ctxName = this.ctx.id.name
    let result = accountIdParam || accountParam || ctxName || ''
    if (!result || result === 'null' || result === 'undefined') {
      result = ''
    }
    return result
  }

  private handleState() {
    const accountId = this.getAccountId()
    return new Response(
      JSON.stringify({
        account: this.account
          ? {
              accountId: accountId,
              rssUrl: this.account.rssUrl,
              order: this.account.order,
              activeSessionId: this.account.activeSessionId,
            }
          : null,
        progress: Object.fromEntries(this.progress),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private isActiveSession(sessionId: string): boolean {
    return this.account?.activeSessionId === sessionId
  }

  private async init() {
    if (this.initialized) return

    try {
      const url = new URL(this.req.url)
      const accountId = url.searchParams.get('accountId') || url.searchParams.get('account') || this.ctx.id.name

      const row = await this.env.DB.prepare(
        'SELECT * FROM accounts WHERE id = ?'
      ).bind(accountId).first<{
        id: string
        rss_url: string | null
        order: string
        active_session_id: string
      }>()

      if (row) {
        this.account = {
          rssUrl: row.rss_url,
          order: (row.order || 'old-to-new') as AccountState['order'],
          activeSessionId: row.active_session_id || '',
        }

        const progressRows = await this.env.DB.prepare(
          'SELECT * FROM episode_progress WHERE account_id = ?'
        ).bind(accountId).all<{
          episode_id: string
          position_sec: number
          updated_at: number
        }>()

        for (const p of progressRows.results || []) {
          this.progress.set(p.episode_id, {
            episodeId: p.episode_id,
            positionSec: p.position_sec,
            updatedAt: p.updated_at,
          })
        }
      } else {
        this.account = {
          rssUrl: null,
          order: 'old-to-new' as AccountState['order'],
          activeSessionId: '',
        }
        await this.persist()
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
    const query = url.searchParams

    if (req.method === 'GET' && path === '/do/state') {
      return this.handleState()
    }

    if (req.method === 'PATCH' && path === '/do/progress') {
      return this.handleProgress(req)
    }

    if (req.method === 'POST' && path === '/do/feed') {
      return this.handleFeed(req)
    }

    if (req.method === 'POST' && path === '/do/takeover') {
      return this.handleTakeover(req)
    }

    return new Response('Not Found', { status: 404 })
  }

  private async handleFeed(req: Request): Promise<Response> {
    const body = await req.json<{
      sessionId: string
      rssUrl: string
      order?: 'new-to-old' | 'old-to-new'
    }>()

    if (!body.sessionId || !this.isActiveSession(body.sessionId)) {
      return new Response(
        JSON.stringify({
          error: 'forbidden',
          message: 'Only active session can update feed',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!this.account) {
      this.account = {
        rssUrl: null,
        order: 'old-to-new',
        activeSessionId: '',
      }
    }

    this.account.rssUrl = body.rssUrl || null
    if (body.order) {
      this.account.order = body.order
    }
    await this.persist()

    return new Response(
      JSON.stringify({ rssUrl: this.account.rssUrl, order: this.account.order }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private async handleTakeover(req: Request): Promise<Response> {
    const body = await req.json<{ sessionId: string }>()

    if (!body.sessionId) {
      return new Response(
        JSON.stringify({
          error: 'missing_credentials',
          message: 'sessionId is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!this.account) {
      this.account = {
        rssUrl: null,
        order: 'old-to-new',
        activeSessionId: body.sessionId,
      }
    } else {
      this.account.activeSessionId = body.sessionId
    }

    await this.persist()

    return new Response(
      JSON.stringify({
        success: true,
        activeSessionId: this.account.activeSessionId,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private async handleProgress(req: Request): Promise<Response> {
    const body = await req.json<{
      sessionId: string
      episodeId: string
      positionSec: number
    }>()

    if (!body.sessionId) {
      return new Response(
        JSON.stringify({
          error: 'missing_credentials',
          message: 'sessionId is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!this.isActiveSession(body.sessionId)) {
      return new Response(
        JSON.stringify({
          error: 'forbidden',
          message: 'Only active session can update progress',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const now = Date.now()

    this.progress.set(body.episodeId, {
      episodeId: body.episodeId,
      positionSec: body.positionSec,
      updatedAt: now,
    })

    await this.persist()

    return new Response(
      JSON.stringify({
        success: true,
        activeSessionId: this.account?.activeSessionId,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  private async persist() {
    if (!this.account) return

    try {
      const accountId = this.getAccountId()
      if (!accountId) return

      await this.env.DB.prepare(
        `INSERT INTO accounts (id, rss_url, order, active_session_id, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           rss_url = excluded.rss_url,
           order = excluded.order,
           active_session_id = excluded.active_session_id,
           updated_at = excluded.updated_at`
      ).bind(
        accountId,
        this.account.rssUrl,
        this.account.order,
        this.account.activeSessionId,
        Date.now()
      ).run()

      for (const [_, p] of this.progress) {
        await this.env.DB.prepare(
          `INSERT INTO episode_progress (account_id, episode_id, position_sec, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id, episode_id) DO UPDATE SET
             position_sec = excluded.position_sec,
             updated_at = excluded.updated_at`
        ).bind(
          accountId,
          p.episodeId,
          p.positionSec,
          p.updatedAt
        ).run()
      }
    } catch {
      // D1 not available in local dev, use in-memory state
    }
  }
}