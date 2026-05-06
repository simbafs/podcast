# AGENTS.md

## Developer Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Build + wrangler dev (runs on 0.0.0.0:8787)
pnpm deploy           # Deploy to Cloudflare
pnpm build            # Full build (css -> worker -> frontend)
```

## Local Dev Setup

1. Create local D1: `pnpm wrangler d1 create podcast-sync --location=wnam`
2. Apply schema: `pnpm wrangler d1 execute podcast-sync --local --file=schema.sql`
3. Update `wrangler.toml` `database_id` to match the created DB name
4. Run `pnpm dev`

## Architecture

- **Backend**: Cloudflare Workers + Hono + Durable Objects
- **Database**: D1 (SQLite) - schema in `schema.sql`
- **Frontend**: Vanilla TS bundled with esbuild, Tailwind CSS v4

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry |
| `src/api.ts` | Hono REST API |
| `src/do.ts` | Durable Object for sync |
| `src/lib/` | Frontend utilities (api, player, storage, rss) |
| `src/assets/` | Static assets (HTML, CSS, JS, SW) |
| `wrangler.toml` | Worker config, D1 + DO bindings |

## Build Notes

- Tailwind v4: Uses CLI directly, no `tailwind.config.js` (see `build:css` script)
- Worker built with esbuild to `dist/`
- Frontend bundled to `src/assets/main.js`

## Important Constraints

- Durable Object lease: 5 minutes, then other devices can takeover
- Session-based locking: only one active playback session per account
- Database ID in wrangler.toml must match your local D1 instance name