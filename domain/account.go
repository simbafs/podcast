package domain

type Account struct {
	ID             string  `json:"id"`
	RSSURL         string  `json:"rss_url"`
	Order          string  `json:"order_dir"`
	CurrentEpisode string  `json:"current_episode_id"`
	Position       float64 `json:"position_sec"`
}


