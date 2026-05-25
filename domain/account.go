// package domain contain the core types of the application
package domain

type Account struct {
	ID             string
	RSSURL         string
	Order          string
	CurrentEpisode string
	Position       int // sec from start
}


