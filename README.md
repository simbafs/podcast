# Podcast Sync

Cross-device podcast playback sync built on Cloudflare Workers + Durable Objects.

## 功能

- RSS Feed 匯入
- 單集新增
- 跨裝置播放進度同步
- 播放衝突解決（takeover 機制）
- PWA 離線支援

## 技術棧

- **Backend**: Cloudflare Workers + Hono + Durable Objects
- **Database**: D1 (SQLite)
- **Frontend**: Vanilla TypeScript + Tailwind CSS v4

## 專案結構

```
src/
├── index.ts          # Worker entry
├── api.ts            # Hono REST API
├── do.ts             # Durable Object
├── lib/
│   ├── api.ts        # Frontend API client
│   ├── player.ts     # Audio player
│   ├── storage.ts    # localStorage wrapper
│   └── rss.ts       # RSS parser
└── assets/
    ├── index.html   # Main HTML
    ├── main.js      # Bundled frontend
    ├── global.css   # Compiled CSS
    └── sw.js        # Service Worker
```

## 本地開發

```bash
# 安裝依賴
pnpm install

# 建立本地 D1 資料庫
pnpm wrangler d1 create podcast-sync --location=wnam

# Apply schema
pnpm wrangler d1 execute podcast-sync --local --file=schema.sql

# 啟動開發伺服器
pnpm dev
```

開啟 `http://localhost:8787`

## 部署

```bash
# 建立 D1 資料庫
pnpm wrangler d1 create podcast-sync

# Apply schema（替換 database_id）
pnpm wrangler d1 execute <database_name> --file=schema.sql

# 部署
pnpm deploy
```

## API

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/state?accountId=` | 取得帳號狀態、進度、episodes |
| PATCH | `/api/progress` | 更新播放進度 |
| POST | `/api/progress` | （sendBeacon）更新進度 |
| POST | `/api/playback/transition` | 原子切換集數 |
| POST | `/api/playback/takeover` | 強制接管播放 |
| GET | `/api/episodes?accountId=` | 取得 episodes |
| POST | `/api/episodes` | 新增 episodes |

## 設計原則

- **鎖的單位**：Account Playback Session（同時間只有一個 active session）
- **Session + Lease**：5 分鐘 lease，過期後其他裝置可接手
- **Transition 原子操作**：切換集數時一次更新 from/to 兩集
- **明確 Takeover**：使用者手動選擇接手播放

## License

MIT