package handlers

import (
	"net/http"

	"podcast/repository"

	"github.com/mmcdole/gofeed"
	"github.com/samber/do/v2"

	"github.com/gin-gonic/gin"
)

type FeedHandler struct {
	repo repository.Account
	fp   *gofeed.Parser
}

func NewFeedHandler(i do.Injector) (*FeedHandler, error) {
	return &FeedHandler{
		repo: do.MustInvoke[repository.Account](i),
		fp:   gofeed.NewParser(),
	}, nil
}

func (f *FeedHandler) GetEpisodes(c *gin.Context) {
	acc, err := f.repo.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if acc.RSSURL == "" {
		c.JSON(http.StatusOK, gin.H{"episodes": []interface{}{}})
		return
	}

	feed, err := f.fp.ParseURL(acc.RSSURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch feed: " + err.Error()})
		return
	}

	type episode struct {
		Title       string  `json:"title"`
		Description string  `json:"description,omitempty"`
		PubDate     string  `json:"pub_date,omitempty"`
		AudioURL    string  `json:"audio_url"`
		Duration    string  `json:"duration,omitempty"`
		GUID        string  `json:"guid"`
	}

	episodes := make([]episode, 0, len(feed.Items))
	for _, item := range feed.Items {
		e := episode{
			Title:       item.Title,
			Description: item.Description,
			PubDate:     item.Published,
			GUID:        item.GUID,
		}
		if len(item.Enclosures) > 0 {
			e.AudioURL = item.Enclosures[0].URL
		}
		if item.Custom != nil {
			if d, ok := item.Custom["itunesduration"]; ok {
				e.Duration = d
			}
		}
		episodes = append(episodes, e)
	}

	c.JSON(http.StatusOK, gin.H{"title": feed.Title, "episodes": episodes})
}
