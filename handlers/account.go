package handlers

import (
	"database/sql"
	"errors"
	"log/slog"
	"net/http"

	"podcast/repository"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"github.com/samber/oops"
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
		err = oops.In("account-handler").Request(c.Request, false).Wrapf(err, "create account")
		slog.ErrorContext(c.Request.Context(), "create account failed", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": oops.GetPublic(err, "Internal server error")})
		return
	}
	c.JSON(http.StatusCreated, acc)
}

func (a *AccountHandler) Get(c *gin.Context) {
	acc, err := a.repo.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		err = oops.In("account-handler").Code("account_get_failed").Request(c.Request, false).Wrapf(err, "get account")
		slog.ErrorContext(c.Request.Context(), "get account failed", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": oops.GetPublic(err, "Internal server error")})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (a *AccountHandler) Update(c *gin.Context) {
	var body struct {
		RSSURL         string   `json:"rss_url"`
		Order          string   `json:"order_dir"`
		CurrentEpisode string   `json:"current_episode_id"`
		Position       *float64 `json:"position_sec"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		err = oops.In("account-handler").Request(c.Request, false).Wrapf(err, "bind update body")
		slog.WarnContext(c.Request.Context(), "invalid update body", slog.Any("error", err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	acc, err := a.repo.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		err = oops.In("account-handler").Code("account_get_failed").Request(c.Request, false).Wrapf(err, "get account for update")
		slog.ErrorContext(c.Request.Context(), "get account for update failed", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": oops.GetPublic(err, "Internal server error")})
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
	if body.Position != nil {
		acc.Position = *body.Position
	}
	if err := a.repo.Update(c.Request.Context(), acc); err != nil {
		err = oops.In("account-handler").Code("account_update_failed").Request(c.Request, false).Wrapf(err, "update account")
		slog.ErrorContext(c.Request.Context(), "update account failed", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": oops.GetPublic(err, "Internal server error")})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (a *AccountHandler) Delete(c *gin.Context) {
	if err := a.repo.Delete(c.Request.Context(), c.Param("id")); err != nil {
		err = oops.In("account-handler").Code("account_delete_failed").Request(c.Request, false).Wrapf(err, "delete account")
		slog.ErrorContext(c.Request.Context(), "delete account failed", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": oops.GetPublic(err, "Internal server error")})
		return
	}
	c.Status(http.StatusNoContent)
}
