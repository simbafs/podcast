package main

import (
	"embed"
	"flag"

	"podcast/db"
	"podcast/repository"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"github.com/simbafs/kama/v2"
)

//go:embed all:ui/dist
var uiFs embed.FS

func run(addr string) error {
	r := gin.Default()

	i := do.New()

	do.ProvideValue(i, db.Must())
	do.Provide(i, repository.NewAccountSqlite)

	k, err := kama.New(uiFs, "localhost:3001", kama.WithStaticPath("ui/dist"))
	if err != nil {
		return err
	}

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

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
