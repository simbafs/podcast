# Podcast Sync - Agent Instructions

## Project Overview
Go + SQLite + WebSocket podcast sync server with React frontend.

## Run Commands

```bash
# Build and run server
cd frontend && pnpm build && cd .. && go build -o server . && ./server -db ./data/podcast.db -port 8080

# Frontend dev
cd frontend && pnpm install && pnpm dev

# Dev mode (kama proxies to Vite dev server)
go run -tags dev .
```

**Build order matters**: `pnpm build` must run before `go build` so `frontend/dist/` exists.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `main.go` | Server entry point |
| `db/` | SQLite connection + schema (embed via go:embed) |
| `handler/` | REST API handlers |
| `player/` | In-memory playback state manager |
| `ws/` | WebSocket hub |
| `frontend/` | React + Vite source code |
| `frontend/dist/` | Compiled static assets (embed into Go binary) |

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Frontend (React app) |
| GET | `/login` | Login page (separate entry) |
| GET | `/ws` | WebSocket upgrade |
| GET | `/api/state?accountId=` | Get account state |
| POST | `/api/feed` | Save RSS URL + order |
| POST | `/api/takeover` | Reset active connection |
| PATCH | `/api/progress` | Update episode progress |
| GET | `/api/proxy?url=` | RSS proxy (CORS bypass) |

## Database
- SQLite at `./data/podcast.db` (auto-created + schema applied on first run)

## WebSocket Protocol

Client → Server:
```json
{"type": "auth", "accountId": "xxx", "connId": "client-generated-id"}
{"type": "play", "episodeId": "ep-1"}
{"type": "pause"}
{"type": "seek", "positionSec": 120.5}
{"type": "takeover"}
{"type": "sync", "episodeId": "ep-1", "positionSec": 45.0, "isPlaying": true}
```

Server → Client:
```json
{"type": "connected", "connId": "conn-xxx"}
{"type": "state", "activeConnId": "...", "episodeId": "...", "positionSec": ..., "isPlaying": true/false}
{"type": "error", "message": "..."}
```

## Frontend Architecture
- Two entry points (`index.html` + `login.html`), no SPA router
- `main.tsx` renders Home page; `login.tsx` renders LoginPage
- Auth check: App checks `localStorage` for accountId, redirects to `/login` if missing
- Login page calls `setAccountId()` then redirects to `/`

## Gotchas
- Active connection断线后**不自动指定**新播放者，需手动 takeover
- 只有 active connection 的 sync 消息会被接受并广播
- SQLite via `modernc.org/sqlite3` (requires CGO)
- 每次修改 `frontend/` 后需重新 `pnpm build` 才能更新 `frontend/dist/`
- `/` 和 `/login` 是分別的 vite entry points，不是 SPA