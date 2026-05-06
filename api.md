# API Specification

## 共通規範

- **所有 API** 都需要 `accountId` + `sessionId` 作為認證，否則回 400
- **讀取 API** 任何 session 都能讀
- **寫入 API** 需是 activeSessionId 否則回 403
- **移除 deviceId**
- 伺服器不儲存播放狀態，只儲存進度

## 共同回復

### Response (400) - 缺少認證

```json
{
	"error": "missing_credentials",
	"message": "accountId and sessionId are required"
}
```

### Response (403) - 不是 active session

```json
{
	"error": "forbidden",
	"message": "Only active session can update progress"
}
```

---

## 1. GET /api/state

讀取帳戶狀態與所有集數進度

### Request

```
GET /api/state?accountId=xxx&sessionId=xxx
```

### Response (200)

```json
{
	"account": {
		"accountId": "xxx",
		"rssUrl": "https://...",
		"order": "old-to-new",
		"activeSessionId": "xxx"
	},
	"progress": {
		"episodeId": "xxx", // guid in rss feed
		"positionSec": 120.5,
		"updatedAt": 1699999999999
	}
}
```

- 客戶端可自行比對 `sessionStorage` 中的 sessionId 與 `account.activeSessionId` 是否一致，來判斷是否為 active session

---

## 2. PATCH /api/progress

更新播放進度（寫入 API）

### Request

```json
{
	"accountId": "xxx",
	"sessionId": "xxx",
	"episodeId": "ep-123",
	"positionSec": 120.5
}
```

| 欄位        | 必填 | 說明               |
| ----------- | ---- | ------------------ |
| accountId   | 是   | 帳戶 ID            |
| sessionId   | 是   | 請求的 session ID  |
| episodeId   | 是   | 集數 ID            |
| positionSec | 是   | 目前播放位置（秒） |

### Response (200)

```json
{
	"success": true,
	"activeSessionId": "xxx"
}
```

---

## 3. POST /api/feed

儲存 RSS feed 與排序偏好（寫入 API）

### Request

```json
{
	"accountId": "xxx",
	"sessionId": "xxx",
	"rssUrl": "https://example.com/feed.xml",
	"order": "new-to-old"
}
```

| 欄位      | 必填 | 說明                             |
| --------- | ---- | -------------------------------- |
| accountId | 是   | 帳戶 ID                          |
| sessionId | 是   | 請求的 session ID                |
| rssUrl    | 是   | RSS feed URL                     |
| order     | 是   | 排序：`old-to-new`, `new-to-new` |

### Response (200)

```json
{
	"rssUrl": "https://example.com/feed.xml",
	"order": "new-to-old"
}
```

---

## 4. POST /api/takeover

接管 active session（寫入 API）

### Request

```json
{
	"accountId": "xxx",
	"sessionId": "xxx"
}
```

| 欄位      | 必填 | 說明              |
| --------- | ---- | ----------------- |
| accountId | 是   | 帳戶 ID           |
| sessionId | 是   | 請求的 session ID |

### Response (200)

```json
{
	"success": true,
	"activeSessionId": "xxx"
}
```

---

## 5. GET /api/proxy

RSS feed 代理（不需要認證）

### Request

```
GET /api/proxy?url=https://example.com/feed.xml
```

### Response

直接返回 RSS XML 內容
