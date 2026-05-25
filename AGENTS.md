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
go run -tag dev . -addr :3000

# Terminal 2 — frontend on :3001
cd ui && pnpm dev
```

- Kill backend: `pkill -f podcast-server` (not `lsof -ti:...`)
- `kama` middleware in `main.go` proxies unknown routes to the Next.js dev server in dev; serves embedded `ui/out/` in production
- Build frontend before backend: `cd ui && pnpm build && cd .. && go build`

## Current gotchas

- **sqlc never configured** — no `sqlc.json`/`sqlc.yaml` exists. You must create one before `sqlc generate` will work
- **`db/schema.sql` is broken** — trailing comma on `position_sec REAL DEFAULT 0,` line; index references nonexistent `episode_progress` table
- **`db/query.sql` is empty** — no queries defined yet

## Project goal

Web-based podcast player with master/slave session sync:

- Create account (UUID) → bind RSS URL to account
- Progress (episode, position) bound to account, synced across devices
- **Master/slave**: first session is master (updates position); second session joins as slave (can stop/seek/choose but NOT update position); slave can `takeover` to become master

### Operations

| Operation     | Who         | Effect                                                |
| ------------- | ----------- | ----------------------------------------------------- |
| `stop`/`play` | any         | Pause/resume progress (ignored if no current episode) |
| `seek`        | any         | Jump to second in current episode                     |
| `choose`      | any         | Pick another episode                                  |
| `takeover`    | slave only  | Slave becomes master, original master becomes slave   |
| `update`      | master only | Broadcast current state (episode, position)           |
