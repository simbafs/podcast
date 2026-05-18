# Podcast Sync Server 重構計劃

## 目標

使用 Go + SQLite + WebSocket 重構現有的 Cloudflare Workers 系統，實現：
- 即時同步播放狀態
- 單一帳號僅允許一個裝置播放
- 其他裝置可控制（暫停、調整進度）但無法實際播放

---

## 架構

```
┌─────────────────────────────────────────────────────────────┐
│                        Go Server (Gin)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   REST API  │  │  WebSocket  │  │  Playback Manager   │  │
│  │   :8080     │  │  /ws        │  │   (in-memory)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│              ┌─────────────────────┐                      │
│              │   SQLite (modernc)   │                      │
│              │   + sqlc             │                      │
│              └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 資料庫 Schema

### accounts 表
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,                    -- 帳號 ID（client 生成）
    rss_url TEXT,                           -- RSS feed URL
    order_dir TEXT DEFAULT 'old-to-new',   -- 播放順序
    active_conn_id TEXT,                    -- 目前播放中的 WebSocket 連線 ID
    current_episode_id TEXT,                -- 正在播放的 episode ID
    position_sec REAL DEFAULT 0,           -- 播放位置（秒）
    is_playing INTEGER DEFAULT 0,          -- 是否正在播放
    created_at INTEGER,
    updated_at INTEGER
);
```

### episode_progress 表
```sql
CREATE TABLE episode_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    position_sec REAL NOT NULL DEFAULT 0,
    updated_at INTEGER,
    UNIQUE(account_id, episode_id)
);
```

---

## 核心設計：Playback Manager

```go
type PlaybackManager struct {
    mu sync.RWMutex
    accounts map[string]*AccountState  // key: accountId
}

type AccountState struct {
    accountId       string
    activeConnId    string              // 正在播放的連線 ID
    currentEpisode  string              // 目前的 episode ID
    positionSec     float64             // 播放位置
    isPlaying       bool
    clients         map[string]*Client  // key: connId
}

type Client struct {
    conn      *websocket.Conn
    accountId string
    connId    string
}
```

### 運作邏輯

1. **連線識別**：每個 WebSocket 連線自動產生 `conn-xxx` ID
2. **身份宣告**：連線後 client 發 `auth` 訊息宣告 accountId
3. **權力轉移**：
   - 第一個連線的 client 自動成為 active（除非已有）
   - `takeover` 訊息可搶 active 權力
4. **狀態同步**：active client 定期發 sync → 廣播給所有 clients

---

## WebSocket 訊息協議

### Client → Server

```json
// 連線後認證（第一個訊息）
{ "type": "auth", "accountId": "acc-123" }

// 播放控制（任何 client 可發送）
{ "type": "play", "episodeId": "ep-1" }
{ "type": "pause" }
{ "type": "seek", "positionSec": 120.5 }
{ "type": "takeover" }

// 同步播放狀態（只有 active connection 有效）
{ "type": "sync", "episodeId": "ep-1", "positionSec": 45.0, "isPlaying": true }
```

### Server → Client

```json
// 廣播播放狀態
{
  "type": "state",
  "activeConnId": "conn-xxx",
  "episodeId": "ep-1",
  "positionSec": 45.0,
  "isPlaying": true
}

// 錯誤訊息
{ "type": "error", "message": "Only active connection can sync position" }
```

---

## REST API Endpoints

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/state?accountId= | 取得帳號狀態和播放進度 |
| POST | /api/feed | 更新 RSS URL 和排序（需 auth） |
| POST | /api/takeover | 搶佔播放權（需 accountId） |
| PATCH | /api/progress | 更新進度（同上，但走 REST） |
| GET | /api/proxy?url= | RSS feed proxy（解決 CORS） |

---

## 前端改動

### 移除
- sessionId 管理
- deviceId 管理
- polling 機制（fetchState 定時拉）

### 新增
- WebSocket 連線
- 接收 state 廣播並更新 UI
- 發送 play/pause/seek/takeover 訊息

### 流程
```javascript
// 1. 建立 WS 連線
const ws = new WebSocket('ws://localhost:8080/ws')

// 2. 認證
ws.send(JSON.stringify({ type: 'auth', accountId: 'xxx' }))

// 3. 接收狀態廣播
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'state') {
    updateUI(msg)  // 更新播放進度、播放狀態
  }
}

// 4. 播放控制
ws.send(JSON.stringify({ type: 'play', episodeId: 'xxx' }))
ws.send(JSON.stringify({ type: 'seek', positionSec: 60 }))
```

---

## 專案結構

```
/home/simba/project/podcast/
├── cmd/server/main.go           # 入口點
├── db/
│   ├── schema.sql               # 資料庫 schema
│   ├── sqlc.yaml              # sqlc 配置
│   └── query/                  # sqlc 生成的 code
│       ├── query.sql.go
│       └── models.go
├── internal/
│   ├── handler/
│   │   ├── state.go            # /api/state
│   │   ├── feed.go             # /api/feed
│   │   └── takeover.go         # /api/takeover
│   ├── ws/
│   │   ├── hub.go              # WebSocket hub
│   │   ├── client.go           # client 連線管理
│   │   └── handler.go          # WS 訊息處理
│   ├── player/
│   │   └── manager.go          # Playback manager
│   └── types.go                # 共用類型
├── frontend/                   # 現有前端（修改 JS）
├── compose.yaml               # Docker compose
├── Dockerfile
├── go.mod
└── README.md
```

---

## 部署

### Docker Compose
```yaml
services:
  podcast-server:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - DB_PATH=/data/podcast.db
      - PORT=8080
```

---

## 待處理細節（已確認）

### 斷線處理
- active client 斷線後**不自動指定**新播放者
- 需由使用者發 `takeover` 訊息才能搶播放權

### RSS 取得方式
1. client 直接 fetch RSS（通常無 CORS）
2. 失敗時才走 `/api/proxy` 由伺服器代理

### 數據持久化
- 播放狀態變化（play/pause/seek）時寫入 SQLite
- 定時 sync（每 30 秒）寫入 SQLite
- 收到 state 廣播時更新 UI

---

## 已實作：Login 頁面

### 新增 /login 路由
- Go server 新增 `/login` 端點，返回登入 HTML

### 前端邏輯
- 無 account 時 redirect 到 `/login`
- `/login` 頁面提供 Create New Account 或 Join Account 選項
- Create：產生 UUID 並存 localStorage
- Join：直接存輸入的 account ID

### 檔案
- `cmd/server/main.go`：新增 `/login` 路由
- `frontend/index.html`：新增 login-page section
- `frontend/main.js`：新增 router 和 login 邏輯
- `frontend/global.css`：新增 login 樣式