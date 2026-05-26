package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"podcast/session"

	"github.com/gorilla/websocket"
	"github.com/samber/do/v2"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

type WSHandler struct {
	mgr      *session.Manager
	upgrader websocket.Upgrader
}

func NewWSHandler(i do.Injector) (*WSHandler, error) {
	return &WSHandler{
		mgr: do.MustInvoke[*session.Manager](i),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}, nil
}

func (h *WSHandler) Handle(c *gin.Context) {
	accountID := c.Param("id")
	if accountID == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("ws upgrade", "error", err)
		return
	}

	s := h.mgr.Connect(accountID, conn)

	h.writeJSON(conn, session.ServerMessage{Type: "role", Role: s.Role.String()})

	if state := h.mgr.GetState(accountID); state != nil {
		h.writeJSON(conn, session.ServerMessage{
			Type:      "state",
			MasterID:  state.MasterID,
			EpisodeID: state.EpisodeID,
			Position:  state.Position,
			Playing:   lo.ToPtr(state.Playing),
		})
	}

	defer func() {
		conn.Close()
		h.mgr.Disconnect(accountID, s.ID)
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Error("ws read", "account", accountID, "error", err)
			}
			break
		}

		var cm session.ClientMessage
		if err := json.Unmarshal(msg, &cm); err != nil {
			slog.Warn("ws unmarshal", "account", accountID, "error", err)
			continue
		}

		h.handleMessage(accountID, s, cm)
	}
}

func (h *WSHandler) handleMessage(accountID string, s *session.Session, cm session.ClientMessage) {
	mgr := h.mgr

	switch cm.Type {
	case "state":
		// Only master can report authoritative state
		if s.Role != session.RoleMaster {
			return
		}
		if cm.Playing == nil {
			return
		}
		episodeID := cm.EpisodeID
		if episodeID == "" {
			if state := mgr.GetState(accountID); state != nil {
				episodeID = state.EpisodeID
			}
		}
		if err := mgr.ApplyState(accountID, episodeID, cm.Position, *cm.Playing); err != nil {
			slog.Error("apply state", "account", accountID, "error", err)
			return
		}
		state := mgr.GetState(accountID)
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			MasterID:  s.ID,
			EpisodeID: state.EpisodeID,
			Position:  state.Position,
			Playing:   lo.ToPtr(state.Playing),
		}, s.ID)

	case "play", "pause", "seek", "choose":
		// Any role: relay command to all other sessions (no server state mutation)
		h.relay(accountID, cm, s.ID)

	case "rss":
		// Persist RSS URL to DB, then relay to all other sessions
		if cm.URL != "" {
			if err := mgr.ApplyRSS(accountID, cm.URL); err != nil {
				slog.Error("apply rss", "account", accountID, "error", err)
			}
		}
		h.relay(accountID, cm, s.ID)

	case "takeover":
		if s.Role != session.RoleSlave {
			return
		}
		newMasterID := mgr.Takeover(accountID, s.ID)
		if newMasterID == "" {
			return
		}
		for _, sess := range mgr.GetSessions(accountID) {
			role := "slave"
			if sess.ID == newMasterID {
				role = "master"
			}
			h.writeJSON(sess.Conn, session.ServerMessage{
				Type: "role",
				Role: role,
			})
		}
		h.broadcast(accountID, session.ServerMessage{
			Type:     "taken_over",
			MasterID: newMasterID,
		}, "")
	}
}

// relay sends the raw message to all sessions except the sender.
func (h *WSHandler) relay(accountID string, msg any, excludeID string) {
	for _, s := range h.mgr.GetSessions(accountID) {
		if s.ID == excludeID {
			continue
		}
		h.writeJSON(s.Conn, msg)
	}
}

// broadcast sends a ServerMessage to all sessions except the sender.
func (h *WSHandler) broadcast(accountID string, msg session.ServerMessage, excludeID string) {
	for _, s := range h.mgr.GetSessions(accountID) {
		if s.ID == excludeID {
			continue
		}
		h.writeJSON(s.Conn, msg)
	}
}

func (h *WSHandler) writeJSON(conn *websocket.Conn, msg any) {
	if err := conn.WriteJSON(msg); err != nil {
		slog.Error("ws write", "error", err)
	}
}
