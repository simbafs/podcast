package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"podcast/session"

	"github.com/gorilla/websocket"
	"github.com/samber/do/v2"

	"github.com/gin-gonic/gin"
)

func boolPtr(b bool) *bool { return &b }

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSHandler struct {
	mgr *session.Manager
}

func NewWSHandler(i do.Injector) (*WSHandler, error) {
	return &WSHandler{
		mgr: do.MustInvoke[*session.Manager](i),
	}, nil
}

func (h *WSHandler) Handle(c *gin.Context) {
	accountID := c.Param("id")
	if accountID == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}

	s := h.mgr.Connect(accountID, conn)

	// Send role assignment
	h.writeJSON(conn, session.ServerMessage{Type: "role", Role: s.Role.String()})

	// Send current state if available
	if state := h.mgr.GetState(accountID); state != nil {
		h.writeJSON(conn, session.ServerMessage{
			Type:      "state",
			MasterID:  state.MasterID,
			EpisodeID: state.EpisodeID,
			Position:  state.Position,
			Playing:   &state.Playing,
		})
	}

	defer func() {
		conn.Close()
		h.mgr.Disconnect(accountID, s.ID)
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var cm session.ClientMessage
		if err := json.Unmarshal(msg, &cm); err != nil {
			continue
		}

		h.handleMessage(accountID, s, cm)
	}
}

func (h *WSHandler) handleMessage(accountID string, s *session.Session, cm session.ClientMessage) {
	mgr := h.mgr
	state := mgr.GetState(accountID)

	switch cm.Type {
	case "update":
		if s.Role != session.RoleMaster {
			return // slave cannot update
		}
		playing := true
		if state != nil {
			playing = state.Playing
		}
		mgr.UpdateState(accountID, cm.EpisodeID, cm.Position, playing)
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			MasterID:  s.ID,
			EpisodeID: cm.EpisodeID,
			Position:  cm.Position,
			Playing:   boolPtr(playing),
		}, "")

	case "stop":
		var episodeID string
		var position float64
		if state != nil {
			episodeID = state.EpisodeID
			position = state.Position
			mgr.UpdateState(accountID, state.EpisodeID, state.Position, false)
		}
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			EpisodeID: episodeID,
			Position:  position,
			Playing:   boolPtr(false),
		}, "")

	case "play":
		var episodeID string
		var position float64
		if state != nil {
			episodeID = state.EpisodeID
			position = state.Position
			mgr.UpdateState(accountID, state.EpisodeID, state.Position, true)
		}
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			EpisodeID: episodeID,
			Position:  position,
			Playing:   boolPtr(true),
		}, "")

	case "seek":
		var episodeID string
		var playing bool
		if state != nil {
			episodeID = state.EpisodeID
			playing = state.Playing
			mgr.UpdateState(accountID, state.EpisodeID, cm.Position, state.Playing)
		}
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			EpisodeID: episodeID,
			Position:  cm.Position,
			Playing:   boolPtr(playing),
		}, "")

	case "choose":
		if state != nil {
			mgr.UpdateState(accountID, cm.EpisodeID, 0, true)
		}
		h.broadcast(accountID, session.ServerMessage{
			Type:      "state",
			EpisodeID: cm.EpisodeID,
			Position:  0,
			Playing:   boolPtr(true),
		}, "")

	case "takeover":
		if s.Role != session.RoleSlave {
			return // only slave can takeover
		}
		newMasterID := mgr.Takeover(accountID, s.ID)
		if newMasterID == "" {
			return
		}
		// Notify all sessions of role change
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
		// Broadcast takeover event
		h.broadcast(accountID, session.ServerMessage{
			Type:     "taken_over",
			MasterID: newMasterID,
		}, "")
	}
}

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
		log.Printf("ws write: %v", err)
	}
}
