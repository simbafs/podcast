package session

import (
	"context"
	"sync"

	"podcast/repository"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Role int

const (
	RoleMaster Role = iota
	RoleSlave
)

func (r Role) String() string {
	switch r {
	case RoleMaster:
		return "master"
	case RoleSlave:
		return "slave"
	}
	return "unknown"
}

type Session struct {
	ID   string
	Role Role
	Conn *websocket.Conn
}

type State struct {
	MasterID  string
	EpisodeID string
	Position  float64
	Playing   bool
	RSSURL    string
}

type ClientMessage struct {
	Type      string  `json:"type"`
	EpisodeID string  `json:"episode_id,omitempty"`
	Position  float64 `json:"position_sec,omitempty"`
	Playing   *bool   `json:"playing,omitempty"`
	URL       string  `json:"url,omitempty"`
}

type ServerMessage struct {
	Type      string  `json:"type"`
	MasterID  string  `json:"master_id,omitempty"`
	EpisodeID string  `json:"episode_id,omitempty"`
	Position  float64 `json:"position_sec,omitempty"`
	Playing   *bool   `json:"playing,omitempty"`
	Role      string  `json:"role,omitempty"`
	URL       string  `json:"url,omitempty"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string][]*Session
	states   map[string]*State
	repo     repository.Account
}

func NewManager(repo repository.Account) *Manager {
	return &Manager{
		sessions: make(map[string][]*Session),
		states:   make(map[string]*State),
		repo:     repo,
	}
}

func (m *Manager) Connect(accountID string, conn *websocket.Conn) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()

	s := &Session{
		ID:   uuid.NewString(),
		Role: RoleSlave,
		Conn: conn,
	}

	sessions := m.sessions[accountID]
	if len(sessions) == 0 {
		s.Role = RoleMaster
	}

	m.sessions[accountID] = append(sessions, s)

	if _, ok := m.states[accountID]; !ok {
		m.states[accountID] = &State{MasterID: s.ID}
	}

	return s
}

func (m *Manager) Disconnect(accountID string, sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sessions := m.sessions[accountID]
	for i, s := range sessions {
		if s.ID == sessionID {
			m.sessions[accountID] = append(sessions[:i], sessions[i+1:]...)
			break
		}
	}

	if len(m.sessions[accountID]) > 0 {
		state := m.states[accountID]
		if state.MasterID == sessionID {
			m.sessions[accountID][0].Role = RoleMaster
			state.MasterID = m.sessions[accountID][0].ID
		}
	}
}

func (m *Manager) Takeover(accountID, sessionID string) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	sessions := m.sessions[accountID]
	if len(sessions) == 0 {
		return ""
	}

	state := m.states[accountID]
	var newMasterID string

	for _, s := range sessions {
		if s.ID == sessionID && s.Role == RoleSlave {
			s.Role = RoleMaster
			newMasterID = s.ID
		} else if s.ID == state.MasterID {
			s.Role = RoleSlave
		}
	}

	if newMasterID != "" {
		state.MasterID = newMasterID
	}

	return newMasterID
}

func (m *Manager) GetSessions(accountID string) []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[accountID]
}

func (m *Manager) GetState(accountID string) *State {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.states[accountID]
}

// ApplyState persists the master's authoritative state to DB immediately
// and updates in-memory state.
func (m *Manager) ApplyState(accountID string, episodeID string, position float64, playing bool) error {
	m.mu.Lock()
	state := m.states[accountID]
	if state == nil {
		m.mu.Unlock()
		return nil
	}
	state.EpisodeID = episodeID
	state.Position = position
	state.Playing = playing
	m.mu.Unlock()

	ctx := context.Background()
	return m.repo.UpdatePosition(ctx, accountID, episodeID, position)
}

// ApplyRSS persists the RSS URL to DB immediately and updates in-memory state.
func (m *Manager) ApplyRSS(accountID string, url string) error {
	m.mu.Lock()
	if state := m.states[accountID]; state != nil {
		state.RSSURL = url
	}
	m.mu.Unlock()

	ctx := context.Background()
	return m.repo.UpdateRSS(ctx, accountID, url)
}
