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
- **Frontend**: React 19 + Vite + TailwindCSS v4 + daisyUI v5

## 專案結構

```
main.go              # 入口點
db/schema.sql        # 資料庫 schema (embed 至執行檔)
db/db.go             # SQLite 連線
handler/             # REST API handlers
  state.go           # /api/state
  feed.go            # /api/feed, /api/takeover
player/              # Playback manager (in-memory)
ws/                  # WebSocket hub
frontend/            # React 前端原始碼 (Vite)
  src/
    pages/          # React pages
    hooks/          # Custom hooks
    components/     # UI components
    lib/             # API, RSS parsing, storage
public/              # 編譯後的 static assets (由 Vite 輸出)
```

## 前端開發

```bash
cd frontend

# 安裝依賴
pnpm install

# 開發模式
pnpm dev

# 編譯 (輸出至 ../public/)
pnpm build
```

## 後端執行

```bash
# 編譯
go build -o server .

# 執行（自動建立 data/podcast.db 並執行 schema）
./server -db ./data/podcast.db -port 8080
```

開啟 `http://localhost:8080`

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