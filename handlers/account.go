package handlers

import (
	"net/http"

	"podcast/repository"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
)

type AccountHandler struct {
	repo repository.Account
}

func NewAccountHandler(i do.Injector) (*AccountHandler, error) {
	return &AccountHandler{
		repo: do.MustInvoke[repository.Account](i),
	}, nil
}

func (a *AccountHandler) Create(c *gin.Context) {
	acc, err := a.repo.Create(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, acc)
}

func (a *AccountHandler) Get(c *gin.Context) {
	acc, err := a.repo.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (a *AccountHandler) Update(c *gin.Context) {
	var body struct {
		RSSURL         string  `json:"rss_url"`
		Order          string  `json:"order_dir"`
		CurrentEpisode string  `json:"current_episode_id"`
		Position       float64 `json:"position_sec"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	acc, err := a.repo.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if body.RSSURL != "" {
		acc.RSSURL = body.RSSURL
	}
	if body.Order != "" {
		acc.Order = body.Order
	}
	if body.CurrentEpisode != "" {
		acc.CurrentEpisode = body.CurrentEpisode
	}
	if body.Position != 0 {
		acc.Position = body.Position
	}
	if err := a.repo.Update(c.Request.Context(), acc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (a *AccountHandler) Delete(c *gin.Context) {
	if err := a.repo.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
