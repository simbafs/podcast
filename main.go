package main

import (
	"embed"
	"flag"

	"podcast/db"
	"podcast/handlers"
	"podcast/repository"

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

	acc := do.MustInvoke[*handlers.AccountHandler](i)

	api := r.Group("/api")
	{
		api.POST("/accounts", acc.Create)
		api.GET("/accounts/:id", acc.Get)
		api.PUT("/accounts/:id", acc.Update)
		api.DELETE("/accounts/:id", acc.Delete)
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
