import { Hono } from 'hono'

export interface Env {
  DB: D1Database
  PROGRESS_DO: DurableObjectNamespace
}

function getDO(env: Env, accountId: string) {
  const id = env.PROGRESS_DO.idFromName(accountId)
  return env.PROGRESS_DO.get(id)
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  app.get('/api/state', async (c) => {
    const accountId = c.req.query('accountId')
    const sessionId = c.req.query('sessionId')

    if (!accountId || !sessionId) {
      return c.json(
        { error: 'missing_credentials', message: 'accountId and sessionId are required' },
        400
      )
    }

    const stub = getDO(c.env, accountId)
    const res = await stub.fetch(
      new Request(`http://localhost/do/state?accountId=${encodeURIComponent(accountId)}`, { method: 'GET' })
    )
    const data = await res.json()
    return c.json(data)
  })

  app.patch('/api/progress', async (c) => {
    const body = await c.req.json<{
      accountId: string
      sessionId: string
      episodeId: string
      positionSec: number
    }>()

    if (!body.accountId || !body.sessionId) {
      return c.json(
        { error: 'missing_credentials', message: 'accountId and sessionId are required' },
        400
      )
    }

    const stub = getDO(c.env, body.accountId)
    const req = new Request(
      `http://localhost/do/progress?accountId=${encodeURIComponent(body.accountId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: body.sessionId,
          episodeId: body.episodeId,
          positionSec: body.positionSec,
        }),
      }
    )

    const res = await stub.fetch(req)

    if (res.status === 403) {
      return c.json(
        { error: 'forbidden', message: 'Only active session can update progress' },
        403
      )
    }

    const data = await res.json()
    return c.json(data)
  })

  app.post('/api/feed', async (c) => {
    const body = await c.req.json<{
      accountId: string
      sessionId: string
      rssUrl: string
      order?: 'new-to-old' | 'old-to-new'
    }>()

    if (!body.accountId || !body.sessionId) {
      return c.json(
        { error: 'missing_credentials', message: 'accountId and sessionId are required' },
        400
      )
    }

    const stub = getDO(c.env, body.accountId)
    const req = new Request(
      `http://localhost/do/feed?accountId=${encodeURIComponent(body.accountId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: body.sessionId,
          rssUrl: body.rssUrl,
          order: body.order,
        }),
      }
    )

    const res = await stub.fetch(req)

    if (res.status === 403) {
      return c.json(
        { error: 'forbidden', message: 'Only active session can update feed' },
        403
      )
    }

    const data = await res.json()
    return c.json(data)
  })

  app.post('/api/takeover', async (c) => {
    const body = await c.req.json<{
      accountId: string
      sessionId: string
    }>()

    if (!body.accountId || !body.sessionId) {
      return c.json(
        { error: 'missing_credentials', message: 'accountId and sessionId are required' },
        400
      )
    }

    const stub = getDO(c.env, body.accountId)
    const req = new Request(
      `http://localhost/do/takeover?accountId=${encodeURIComponent(body.accountId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: body.sessionId }),
      }
    )

    const res = await stub.fetch(req)
    const data = await res.json()
    return c.json(data)
  })

  app.get('/api/proxy', async (c) => {
    const url = c.req.query('url')
    if (!url) {
      return c.json({ error: 'url required' }, 400)
    }

    const res = await fetch(url)
    const contentType = res.headers.get('content-type') || ''
    const body = await res.text()

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    })
  })

  app.notFound((c) => c.text('Not Found', 404))

  return app
}