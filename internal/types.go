package internal

type AccountState struct {
	AccountID       string  `json:"accountId"`
	RssURL          *string `json:"rssUrl"`
	OrderDir        string  `json:"orderDir"`
	ActiveConnID    string  `json:"activeConnId"`
	CurrentEpisode  string  `json:"currentEpisodeId"`
	PositionSec     float64 `json:"positionSec"`
	IsPlaying       bool    `json:"isPlaying"`
	UpdatedAt       int64   `json:"updatedAt"`
}

type EpisodeProgress struct {
	AccountID   string  `json:"accountId"`
	EpisodeID   string  `json:"episodeId"`
	PositionSec float64 `json:"positionSec"`
	UpdatedAt   int64   `json:"updatedAt"`
}

type StateResponse struct {
	Account  *AccountState               `json:"account"`
	Progress map[string]EpisodeProgress `json:"progress"`
}

type FeedRequest struct {
	AccountID string `json:"accountId" binding:"required"`
	RssURL    string `json:"rssUrl"`
	OrderDir  string `json:"orderDir"`
}

type TakeoverRequest struct {
	AccountID string `json:"accountId" binding:"required"`
}

type ProgressRequest struct {
	AccountID   string  `json:"accountId" binding:"required"`
	EpisodeID   string  `json:"episodeId" binding:"required"`
	PositionSec float64 `json:"positionSec"`
}