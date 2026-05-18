package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"podcast-sync/internal/player"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Hub struct {
	manager   *player.Manager
	clients   map[string]*Client
	register  chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMsg
	mu         sync.RWMutex
}

type BroadcastMsg struct {
	AccountID string
	Message   []byte
}

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	accountID string
	connID    string
}

type WSMessage struct {
	Type string `json:"type"`
}

type AuthMessage struct {
	Type      string `json:"type"`
	AccountID string `json:"accountId"`
	ConnID    string `json:"connId,omitempty"`
}

type PlayMessage struct {
	Type      string `json:"type"`
	EpisodeID string `json:"episodeId"`
}

type PauseMessage struct {
	Type string `json:"type"`
}

type SeekMessage struct {
	Type        string  `json:"type"`
	PositionSec float64 `json:"positionSec"`
}

type TakeoverMessage struct {
	Type string `json:"type"`
}

type SyncMessage struct {
	Type        string  `json:"type"`
	EpisodeID   string  `json:"episodeId"`
	PositionSec float64 `json:"positionSec"`
	IsPlaying   bool    `json:"isPlaying"`
}

func NewHub(manager *player.Manager) *Hub {
	return &Hub{
		manager:   manager,
		clients:   make(map[string]*Client),
		register:  make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMsg, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.connID] = client
			h.mu.Unlock()
			log.Printf("Client connected: %s (account: %s)", client.connID, client.accountID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.connID]; ok {
				delete(h.clients, client.connID)
				close(client.send)
			}
			h.mu.Unlock()

			if client.accountID != "" {
				h.manager.RemoveClient(client.accountID, client.connID)
				h.manager.BroadcastState(client.accountID)
			}
			log.Printf("Client disconnected: %s", client.connID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				if client.accountID == msg.AccountID {
					select {
					case client.send <- msg.Message:
					default:
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	connID := generateConnID()
	client := &Client{
		hub:    h,
		conn:   conn,
		send:   make(chan []byte, 256),
		connID: connID,
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(data []byte) {
	var baseMsg WSMessage
	if err := json.Unmarshal(data, &baseMsg); err != nil {
		return
	}

	switch baseMsg.Type {
	case "auth":
		var msg AuthMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		c.handleAuth(msg.AccountID, msg.ConnID)

	case "play":
		var msg PlayMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		c.handlePlay(msg.EpisodeID)

	case "pause":
		c.handlePause()

	case "seek":
		var msg SeekMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		c.handleSeek(msg.PositionSec)

	case "takeover":
		c.handleTakeover()

	case "sync":
		var msg SyncMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		c.handleSync(msg.EpisodeID, msg.PositionSec, msg.IsPlaying)
	}
}

func (c *Client) handleAuth(accountID string, clientConnID string) {
	c.accountID = accountID
	if clientConnID != "" {
		c.connID = clientConnID
	}
	c.hub.manager.AddClient(accountID, c.connID, c.send)

	connectedMsg := map[string]any{
		"type":    "connected",
		"connId":  c.connID,
	}
	data, _ := json.Marshal(connectedMsg)
	c.send <- data

	c.hub.manager.BroadcastState(accountID)
	log.Printf("Client %s authenticated to account %s", c.connID, accountID)
}

func (c *Client) handlePlay(episodeID string) {
	if c.accountID == "" {
		return
	}

	ok := c.hub.manager.Play(c.accountID, c.connID, episodeID)
	if !ok {
		c.hub.manager.BroadcastError(c.accountID, c.connID, "Only active connection can play")
		return
	}

	c.hub.manager.BroadcastState(c.accountID)
}

func (c *Client) handlePause() {
	if c.accountID == "" {
		return
	}

	ok := c.hub.manager.Pause(c.accountID, c.connID)
	if !ok {
		c.hub.manager.BroadcastError(c.accountID, c.connID, "Only active connection can pause")
		return
	}

	c.hub.manager.BroadcastState(c.accountID)
}

func (c *Client) handleSeek(positionSec float64) {
	if c.accountID == "" {
		return
	}

	ok := c.hub.manager.Seek(c.accountID, c.connID, positionSec)
	if !ok {
		c.hub.manager.BroadcastError(c.accountID, c.connID, "Only active connection can seek")
		return
	}

	c.hub.manager.BroadcastState(c.accountID)
}

func (c *Client) handleTakeover() {
	if c.accountID == "" {
		return
	}

	ok := c.hub.manager.Takeover(c.accountID, c.connID)
	if !ok {
		c.hub.manager.BroadcastError(c.accountID, c.connID, "Cannot takeover - client not connected to this account")
		return
	}

	c.hub.manager.BroadcastState(c.accountID)
	log.Printf("Client %s took over account %s", c.connID, c.accountID)
}

func (c *Client) handleSync(episodeID string, positionSec float64, isPlaying bool) {
	if c.accountID == "" {
		return
	}

	ok, _ := c.hub.manager.Sync(c.accountID, c.connID, episodeID, positionSec, isPlaying)
	if !ok {
		c.hub.manager.BroadcastError(c.accountID, c.connID, "Only active connection can sync position")
		return
	}

	c.hub.manager.BroadcastState(c.accountID)
}

func generateConnID() string {
	return fmt.Sprintf("conn-%d", time.Now().UnixNano())
}