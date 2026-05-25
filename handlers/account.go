// Package handlers provide HTTP handlers for the application
package handlers

import (
	"podcast/repository"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
)

type AccountHandler struct {
	accountRepo repository.Account
}

func NewAccountHandler(i do.Injector) (*AccountHandler, error) {
	return &AccountHandler{
		accountRepo: do.MustInvoke[repository.Account](i),
	}, nil
}

func (a *AccountHandler) Create(c *gin.Context) {
	panic("not implemented")
}

func (*AccountHandler) Get(c *gin.Context) {
}
