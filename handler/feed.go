package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"podcast-sync/db"
	"podcast-sync/player"
)

type FeedHandler struct {
	manager *player.Manager
}

func NewFeedHandler(manager *player.Manager) *FeedHandler {
	return &FeedHandler{manager: manager}
}

func (h *FeedHandler) SaveFeed(c *gin.Context) {
	var req struct {
		AccountID string `json:"accountId" binding:"required"`
		RssURL    string `json:"rssUrl"`
		OrderDir  string `json:"orderDir"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_credentials", "message": "accountId is required"})
		return
	}

	if req.AccountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_credentials", "message": "accountId is required"})
		return
	}

	orderDir := req.OrderDir
	if orderDir == "" {
		orderDir = "old-to-new"
	}

	now := time.Now().UnixMilli()

	_, err := db.GetDB().Exec(`
		INSERT INTO accounts (id, rss_url, order_dir, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			rss_url = excluded.rss_url,
			order_dir = excluded.order_dir,
			updated_at = excluded.updated_at
	`, req.AccountID, req.RssURL, orderDir, now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": err.Error()})
		return
	}

	accState := h.manager.GetAccount(req.AccountID)
	if accState != nil {
		accState.OrderDir = orderDir
		if req.RssURL != "" {
			accState.RssURL = req.RssURL
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"rssUrl":  req.RssURL,
		"order":   orderDir,
	})
}

func (h *FeedHandler) Takeover(c *gin.Context) {
	var req struct {
		AccountID string `json:"accountId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_credentials", "message": "accountId is required"})
		return
	}

	now := time.Now().UnixMilli()

	_, err := db.GetDB().Exec(`
		INSERT INTO accounts (id, active_conn_id, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			active_conn_id = excluded.active_conn_id,
			updated_at = excluded.updated_at
	`, req.AccountID, "", now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"activeConnId": "",
	})
}

func (h *FeedHandler) UpdateProgress(c *gin.Context) {
	var req struct {
		AccountID   string  `json:"accountId" binding:"required"`
		EpisodeID   string  `json:"episodeId" binding:"required"`
		PositionSec float64 `json:"positionSec"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_credentials", "message": "accountId and episodeId are required"})
		return
	}

	now := time.Now().UnixMilli()

	_, err := db.GetDB().Exec(`
		INSERT INTO episode_progress (account_id, episode_id, position_sec, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(account_id, episode_id) DO UPDATE SET
			position_sec = excluded.position_sec,
			updated_at = excluded.updated_at
	`, req.AccountID, req.EpisodeID, req.PositionSec, now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": err.Error()})
		return
	}

	accState := h.manager.GetAccount(req.AccountID)
	if accState != nil {
		accState.CurrentEpisode = req.EpisodeID
		accState.PositionSec = req.PositionSec
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}