# Podcast Sync - Agent Instructions

## Project Overview
Go + SQLite + WebSocket podcast sync server with React frontend.

## Run Commands

```bash
# Build and run server
go build -o server . && ./server -db ./data/podcast.db -port 8080

# Frontend dev
cd frontend && pnpm install && pnpm dev

# Frontend build (outputs to ../public/)
cd frontend && pnpm build
```

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `main.go` | Server entry point |
| `db/` | SQLite connection + schema (embed via go:embed) |
| `handler/` | REST API handlers |
| `player/` | In-memory playback state manager |
| `ws/` | WebSocket hub |
| `frontend/` | React + Vite source code |
| `public/` | Compiled static assets |

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Frontend (React SPA) |
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

## Gotchas
- Active connection断线后**不自动指定**新播放者，需手动 takeover
- 只有 active connection 的 sync 消息会被接受并广播
- SQLite via `modernc.org/sqlite3` (requires CGO)
- 每次修改 `frontend/` 后需重新 `pnpm build` 才能更新 `public/`