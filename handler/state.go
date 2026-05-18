package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"podcast-sync/db"
	"podcast-sync/player"
)

type StateHandler struct {
	manager *player.Manager
}

func NewStateHandler(manager *player.Manager) *StateHandler {
	return &StateHandler{manager: manager}
}

func (h *StateHandler) GetState(c *gin.Context) {
	accountID := c.Query("accountId")
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_credentials", "message": "accountId is required"})
		return
	}

	accState := h.manager.GetAccount(accountID)

	rows, err := db.GetDB().Query(`
		SELECT id, rss_url, order_dir, active_conn_id, current_episode_id, position_sec, is_playing, updated_at
		FROM accounts WHERE id = ?
	`, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": err.Error()})
		return
	}
	defer rows.Close()

	var rssURL, activeConnID, currentEpisodeID sql.NullString
	var positionSec float64
	var isPlaying int
	var updatedAt int64
	var orderDir string

	if rows.Next() {
		err := rows.Scan(&accountID, &rssURL, &orderDir, &activeConnID, &currentEpisodeID, &positionSec, &isPlaying, &updatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": err.Error()})
			return
		}
	}

	if accState == nil && !rssURL.Valid {
		c.JSON(http.StatusOK, gin.H{
			"account":  nil,
			"progress": map[string]any{},
		})
		return
	}

	progressMap := make(map[string]any)
	progressRows, err := db.GetDB().Query(`
		SELECT episode_id, position_sec, updated_at
		FROM episode_progress WHERE account_id = ?
	`, accountID)
	if err == nil {
		defer progressRows.Close()
		for progressRows.Next() {
			var epID string
			var posSec float64
			var upAt int64
			progressRows.Scan(&epID, &posSec, &upAt)
			progressMap[epID] = map[string]any{
				"episodeId":    epID,
				"positionSec":  posSec,
				"updatedAt":    upAt,
			}
		}
	}

	activeConn := ""
	if accState != nil {
		activeConn = accState.ActiveConnID
	} else if activeConnID.Valid {
		activeConn = activeConnID.String
	}

	currentEp := ""
	if accState != nil && accState.CurrentEpisode != "" {
		currentEp = accState.CurrentEpisode
	} else if currentEpisodeID.Valid {
		currentEp = currentEpisodeID.String
	}

	pos := positionSec
	if accState != nil && accState.PositionSec > 0 {
		pos = accState.PositionSec
	}

	playing := isPlaying == 1
	if accState != nil {
		playing = accState.IsPlaying
	}

	order := orderDir
	if order == "" {
		order = "old-to-new"
	}

	c.JSON(http.StatusOK, gin.H{
		"account": map[string]any{
			"accountId":      accountID,
			"rssUrl":         rssURL.String,
			"orderDir":       order,
			"activeConnId":   activeConn,
			"currentEpisodeId": currentEp,
			"positionSec":    pos,
			"isPlaying":      playing,
			"updatedAt":      updatedAt,
		},
		"progress": progressMap,
	})
}