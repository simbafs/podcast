# Podcast Sync - Agent Instructions

## Project Overview
Go + SQLite + WebSocket podcast sync server with vanilla JS frontend.

## Run Commands

```bash
# Build and run locally
go build -o server . && ./server -db ./data/podcast.db -port 8080

# Docker
docker compose up -d
```

**Note**: Entry point is `./main.go` at root (not `./cmd/server` as some docs claim - the Dockerfile has this bug).

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `main.go` | Server entry point |
| `db/` | SQLite connection + schema |
| `handler/` | REST API handlers (state, feed, takeover) |
| `player/` | In-memory playback state manager |
| `ws/` | WebSocket hub and client handling |
| `frontend/` | Static HTML/JS/CSS |

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Frontend index.html |
| GET | `/login` | Login page |
| GET | `/ws` | WebSocket upgrade |
| GET | `/api/state?accountId=` | Get account state |
| POST | `/api/feed` | Save RSS URL + order |
| POST | `/api/takeover` | Reset active connection |
| PATCH | `/api/progress` | Update episode progress |
| GET | `/api/proxy?url=` | RSS proxy (CORS bypass) |

## Database
- SQLite at `./data/podcast.db` (auto-created on first run)
- Schema in `db/schema.sql`

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
- SQLite via `modernc.org/sqlite3` (requires CGO, see Dockerfile)