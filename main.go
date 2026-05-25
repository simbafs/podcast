package main

import (
	"embed"
	"flag"

	"podcast/db"
	"podcast/handlers"
	"podcast/repository"
	"podcast/session"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"github.com/simbafs/kama/v2"
)

//go:embed all:ui/out
var uiFs embed.FS

func run(addr string) error {
	r := gin.Default()

	i := do.New()

	do.ProvideValue(i, db.Must())
	do.Provide(i, repository.NewAccountSqlite)
	do.Provide(i, handlers.NewAccountHandler)
	do.Provide(i, handlers.NewFeedHandler)
	do.Provide(i, handlers.NewWSHandler)
	do.Provide(i, func(i do.Injector) (*session.Manager, error) {
		return session.NewManager(do.MustInvoke[repository.Account](i)), nil
	})

	acc := do.MustInvoke[*handlers.AccountHandler](i)
	feed := do.MustInvoke[*handlers.FeedHandler](i)
	ws := do.MustInvoke[*handlers.WSHandler](i)

	api := r.Group("/api")
	{
		api.POST("/accounts", acc.Create)
		api.GET("/accounts/:id", acc.Get)
		api.PUT("/accounts/:id", acc.Update)
		api.DELETE("/accounts/:id", acc.Delete)
		api.GET("/accounts/:id/feed", feed.GetEpisodes)
		api.GET("/accounts/:id/ws", ws.Handle)
	}

	k, err := kama.New(uiFs, "http://localhost:3001", kama.WithStaticPath("ui/out"))
	if err != nil {
		return err
	}
	r.Use(k.Gin())

	return r.Run(addr)
}

func main() {
	addr := flag.String("addr", ":3000", "address to listen on")
	flag.Parse()

	if err := run(*addr); err != nil {
		panic(err)
	}
}
