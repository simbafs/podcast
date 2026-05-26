package session

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"podcast/repository"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/samber/oops"
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
	Dirty     bool
}

type ClientMessage struct {
	Type      string  `json:"type"`
	EpisodeID string  `json:"episode_id,omitempty"`
	Position  float64 `json:"position_sec,omitempty"`
}

type ServerMessage struct {
	Type      string  `json:"type"`
	MasterID  string  `json:"master_id,omitempty"`
	EpisodeID string  `json:"episode_id,omitempty"`
	Position  float64 `json:"position_sec,omitempty"`
	Playing   *bool   `json:"playing,omitempty"`
	Role      string  `json:"role,omitempty"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string][]*Session
	states   map[string]*State
	repo     repository.Account
	stopCh   chan struct{}
	doneCh   chan struct{}
	stopOnce sync.Once
}

func NewManager(repo repository.Account) *Manager {
	m := &Manager{
		sessions: make(map[string][]*Session),
		states:   make(map[string]*State),
		repo:     repo,
		stopCh:   make(chan struct{}),
		doneCh:   make(chan struct{}),
	}
	go m.flushLoopGuard()
	return m
}

func (m *Manager) Stop() {
	m.stopOnce.Do(func() {
		close(m.stopCh)
		<-m.doneCh // wait for final flush to complete
	})
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

	// If master disconnected, promote oldest slave
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

func (m *Manager) UpdateState(accountID string, episodeID string, position float64, playing bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	state := m.states[accountID]
	if state == nil {
		slog.Warn("UpdateState called without Connect", "account_id", accountID)
		return
	}
	state.EpisodeID = episodeID
	state.Position = position
	state.Playing = playing
	state.Dirty = true
}

func (m *Manager) flushLoopGuard() {
	if err := oops.In("session-manager").Code("flush_loop_panic").Recover(m.flushLoop); err != nil {
		slog.Error("flush loop recovered from panic", slog.Any("error", err))
	}
}

func (m *Manager) flushLoop() {
	defer close(m.doneCh)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-m.stopCh:
			m.flush()
			return
		case <-ticker.C:
			m.flush()
		}
	}
}

func (m *Manager) flush() {
	m.mu.Lock()
	type dirtyEntry struct {
		id       string
		position float64
		episode  string
	}
	var dirty []dirtyEntry
	for accountID, state := range m.states {
		if state.Dirty {
			dirty = append(dirty, dirtyEntry{id: accountID, position: state.Position, episode: state.EpisodeID})
			state.Dirty = false
		}
	}
	m.mu.Unlock()

	ctx := context.Background()
	for _, d := range dirty {
		if err := m.repo.UpdatePosition(ctx, d.id, d.episode, d.position); err != nil {
			slog.Error("flush: update position", "account", d.id, "error", err)
			m.mu.Lock()
			if state, ok := m.states[d.id]; ok {
				state.Dirty = true
			}
			m.mu.Unlock()
		}
	}
}
