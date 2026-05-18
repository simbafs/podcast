package player

import (
	"encoding/json"
	"sync"
	"time"
)

type Manager struct {
	mu       sync.RWMutex
	accounts map[string]*AccountState
}

type AccountState struct {
	AccountID       string
	ActiveConnID    string
	CurrentEpisode  string
	PositionSec     float64
	IsPlaying       bool
	Clients         map[string]*Client
	LastSyncAt      int64
	OrderDir        string
	RssURL          string
}

type Client struct {
	ConnID    string
	AccountID string
	Conn      interface{}
	Send      chan []byte
}

type StateMessage struct {
	Type          string  `json:"type"`
	ActiveConnID  string  `json:"activeConnId"`
	EpisodeID     string  `json:"episodeId"`
	PositionSec   float64 `json:"positionSec"`
	IsPlaying     bool    `json:"isPlaying"`
}

type ErrorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func NewManager() *Manager {
	return &Manager{
		accounts: make(map[string]*AccountState),
	}
}

func (m *Manager) GetOrCreateAccount(accountID string) *AccountState {
	m.mu.Lock()
	defer m.mu.Unlock()

	if acc, ok := m.accounts[accountID]; ok {
		return acc
	}

	acc := &AccountState{
		AccountID:  accountID,
		Clients:    make(map[string]*Client),
		OrderDir:   "old-to-new",
	}
	m.accounts[accountID] = acc
	return acc
}

func (m *Manager) GetAccount(accountID string) *AccountState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.accounts[accountID]
}

func (m *Manager) AddClient(accountID, connID string, sendChan chan []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		acc = &AccountState{
			AccountID: accountID,
			Clients:   make(map[string]*Client),
		}
		m.accounts[accountID] = acc
	}

	acc.Clients[connID] = &Client{
		ConnID:    connID,
		AccountID: accountID,
		Send:      sendChan,
	}

	if acc.ActiveConnID == "" {
		acc.ActiveConnID = connID
	}
}

func (m *Manager) RemoveClient(accountID, connID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return
	}

	delete(acc.Clients, connID)

	if acc.ActiveConnID == connID {
		acc.ActiveConnID = ""
		acc.IsPlaying = false
	}
}

func (m *Manager) Takeover(accountID, connID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return false
	}

	if acc.ActiveConnID != "" && acc.ActiveConnID != connID {
		_, hasClient := acc.Clients[connID]
		if !hasClient {
			return false
		}
	}

	acc.ActiveConnID = connID
	acc.IsPlaying = false
	acc.PositionSec = 0
	acc.CurrentEpisode = ""
	return true
}

func (m *Manager) Play(accountID, connID, episodeID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return false
	}

	if acc.ActiveConnID != connID {
		return false
	}

	acc.CurrentEpisode = episodeID
	acc.IsPlaying = true
	acc.LastSyncAt = time.Now().UnixMilli()
	return true
}

func (m *Manager) Pause(accountID, connID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return false
	}

	if acc.ActiveConnID != connID {
		return false
	}

	acc.IsPlaying = false
	acc.LastSyncAt = time.Now().UnixMilli()
	return true
}

func (m *Manager) Seek(accountID, connID string, positionSec float64) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return false
	}

	if acc.ActiveConnID != connID {
		return false
	}

	acc.PositionSec = positionSec
	acc.LastSyncAt = time.Now().UnixMilli()
	return true
}

func (m *Manager) Sync(accountID, connID, episodeID string, positionSec float64, isPlaying bool) (bool, *AccountState) {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		return false, nil
	}

	if acc.ActiveConnID != connID {
		return false, acc
	}

	acc.CurrentEpisode = episodeID
	acc.PositionSec = positionSec
	acc.IsPlaying = isPlaying
	acc.LastSyncAt = time.Now().UnixMilli()

	return true, acc
}

func (m *Manager) BroadcastState(accountID string) {
	m.mu.RLock()
	acc := m.accounts[accountID]
	clients := make(map[string]*Client, len(acc.Clients))
	for k, v := range acc.Clients {
		clients[k] = v
	}
	m.mu.RUnlock()

	if acc == nil {
		return
	}

	stateMsg := StateMessage{
		Type:          "state",
		ActiveConnID:  acc.ActiveConnID,
		EpisodeID:     acc.CurrentEpisode,
		PositionSec:   acc.PositionSec,
		IsPlaying:     acc.IsPlaying,
	}

	data, _ := json.Marshal(stateMsg)

	for _, client := range clients {
		select {
		case client.Send <- data:
		default:
		}
	}
}

func (m *Manager) BroadcastError(accountID, connID, message string) {
	m.mu.RLock()
	acc := m.accounts[accountID]
	if acc == nil {
		m.mu.RUnlock()
		return
	}
	client, exists := acc.Clients[connID]
	m.mu.RUnlock()

	if !exists {
		return
	}

	errMsg := ErrorMessage{
		Type:    "error",
		Message: message,
	}
	data, _ := json.Marshal(errMsg)

	select {
	case client.Send <- data:
	default:
	}
}

func (m *Manager) UpdateFromDB(accountID string, activeConnID, currentEpisode string, positionSec float64, isPlaying bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	acc := m.accounts[accountID]
	if acc == nil {
		acc = &AccountState{
			AccountID:      accountID,
			Clients:        make(map[string]*Client),
			ActiveConnID:   activeConnID,
			CurrentEpisode: currentEpisode,
			PositionSec:    positionSec,
			IsPlaying:      isPlaying,
		}
		m.accounts[accountID] = acc
	} else {
		acc.ActiveConnID = activeConnID
		acc.CurrentEpisode = currentEpisode
		acc.PositionSec = positionSec
		acc.IsPlaying = isPlaying
	}
}