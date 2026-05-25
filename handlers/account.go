// Package handlers provide HTTP handlers for the application
package handlers

import (
	"podcast/db"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
)

type AccountHandler struct {
	db *db.DB
}

func NewAccountHandler(i do.Injector) (*AccountHandler, error) {
	return &AccountHandler{
		db: do.MustInvoke[*db.DB](i),
	}, nil
}

func (a *AccountHandler) Create(c *gin.Context) {
	panic("not implemented")
}

func (* AccountHandler) Get(c *gin.Context) {

}
