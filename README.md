# Podcast Sync

Cross-device podcast playback sync built on Go + SQLite + WebSocket.

## 功能

- RSS Feed 匯入
- 跨裝置播放進度同步
- 單一裝置播放，其他可控制（暫停、調整進度）
- Takeover 機制搶佔播放權
- 即時狀態同步 via WebSocket

## 技術棧

- **Backend**: Go + Gin + gorilla/websocket
- **Database**: SQLite (modernc.org/sqlite3)
- **Frontend**: Vanilla JavaScript + WebSocket

## 專案結構

```
cmd/server/main.go       # 入口點
db/schema.sql           # 資料庫 schema
internal/
├── handler/            # REST API handlers
│   ├── state.go        # /api/state
│   └── feed.go         # /api/feed, /api/takeover
├── player/             # Playback manager (in-memory)
│   └── manager.go
├── ws/                 # WebSocket hub
│   └── hub.go
├── db/                 # SQLite 連線
│   └── db.go
└── types.go            # 共用類型
frontend/               # 靜態前端
├── index.html
├── main.js
└── global.css
```

## 本地開發

```bash
# 編譯
go build -o server ./cmd/server

# 執行（自動建立 data/podcast.db）
./server -db ./data/podcast.db -port 8080
```

開啟 `http://localhost:8080`

## Docker

```bash
# 編譯映像
docker build -t podcast-sync .

# 執行
docker run -p 8080:8080 -v ./data:/data podcast-sync
```

或使用 docker compose：

```bash
docker compose up -d
```

## WebSocket 訊息協議

### Client → Server

```json
{ "type": "auth", "accountId": "xxx", "connId": "client-generated-id" }
{ "type": "play", "episodeId": "ep-1" }
{ "type": "pause" }
{ "type": "seek", "positionSec": 120.5 }
{ "type": "takeover" }
{ "type": "sync", "episodeId": "ep-1", "positionSec": 45.0, "isPlaying": true }
```

### Server → Client

```json
{ "type": "connected", "connId": "conn-xxx" }
{ "type": "state", "activeConnId": "conn-xxx", "episodeId": "ep-1", "positionSec": 45.0, "isPlaying": true }
{ "type": "error", "message": "Only active connection can play" }
```

## REST API

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/state?accountId=` | 取得帳號狀態、進度 |
| POST | `/api/feed` | 更新 RSS URL 和排序 |
| POST | `/api/takeover` | 重置 active connection |
| PATCH | `/api/progress` | 更新單集播放進度 |
| GET | `/api/proxy?url=` | RSS feed proxy |
| GET | `/ws` | WebSocket 端點 |

## 設計原則

- **連線識別**：WebSocket 連線本身 = 裝置身份
- **播放控制**：任何 client 可發 play/pause/seek
- **位置同步**：只有 active connection 的 sync 才會被接受
- **Takeover**：使用者手動搶佔播放權
- **斷線處理**：active 斷線後不自動指定新人

## License

MIT