# Podcast Player — Go + Next.js

Go backend (gin, samber/do, sqlc/SQLite) + Next.js 16 static-export frontend in `ui/`.

Shared conventions (Go style, Prettier, commit signing, etc.) live in `~/.config/opencode/AGENTS.md`. This file covers only repo-specific guidance.

## Architecture rules

- DB access ONLY through `repository/<name>.go` interfaces using `domain/` structs
- sqlc queries in `db/query.sql`, schema in `db/schema.sql`
- DI via `github.com/samber/do/v2` — see `main.go` for the provider/injector pattern
- JSON API only; frontend is a static export (Next.js `output: "export"`), no SSR
- Go packages at project root level (no `pkg/`, `internal/`, `cmd/`)

## Dev workflow

```bash
# Terminal 1 — backend on :3000
go run . --addr :3000

# Terminal 2 — frontend on :3001
cd ui && pnpm dev
```

- Kill backend: `pkill -f podcast-server` (not `lsof -ti:...`)
- `kama` middleware in `main.go` proxies unknown routes to the Next.js dev server in dev; serves embedded `ui/out/` in production
- Build frontend before backend: `cd ui && pnpm build && cd .. && go build`
- Docker build (requires `ui/out/` pre-built): `cd ui && pnpm build && cd .. && docker build -t podcast-server .`

## Current gotchas

- **sqlc never configured** — no `sqlc.json`/`sqlc.yaml` exists. You must create one before `sqlc generate` will work
- **`db/query.sql` is empty** — no queries defined yet

## Project goal

Web-based podcast player with master/slave session sync:

- Create account (UUID) → bind RSS URL to account
- Progress (episode, position) bound to account, synced across devices
- **Master/slave**: first session is master (updates position); second session joins as slave (can stop/seek/choose but NOT update position); slave can `takeover` to become master

### API

| Endpoint | Method | Description |
|---|---|---|
| `/api/accounts` | POST | Create account (returns UUID) |
| `/api/accounts/:id` | GET | Get account |
| `/api/accounts/:id` | PUT | Update account (rss_url, etc.) |
| `/api/accounts/:id` | DELETE | Delete account |
| `/api/accounts/:id/feed` | GET | Fetch RSS feed as JSON episodes |
| `/api/accounts/:id/ws` | GET | WebSocket for real-time sync |

### WebSocket protocol

| Direction | Type | Payload | Note |
|---|---|---|---|
| any → server | `stop` / `play` | — | toggle playback |
| any → server | `seek` | `{position_sec}` | jump to time |
| any → server | `choose` | `{episode_id}` | switch episode |
| slave → server | `takeover` | — | requesting slave becomes master |
| master → server | `update` | `{episode_id, position_sec}` | broadcast state (rate-limited ~5s) |
| server → all | `state` | `{master_id, episode_id, position, playing}` | current state |
| server → one | `role` | `{role: "master"\|"slave"}` | assigned on connect |
