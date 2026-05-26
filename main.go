package main

import (
	"context"
	"database/sql"
	"embed"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"podcast/db"
	"podcast/handlers"
	"podcast/repository"
	"podcast/session"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"github.com/samber/oops"
	"github.com/simbafs/kama/v2"
)

//go:embed all:ui/out
var uiFs embed.FS

func run(addr, devProxy string) error {
	i := do.New()

	do.Provide(i, func(_ do.Injector) (*sql.DB, error) {
		return db.Open()
	})
	do.Provide(i, repository.NewAccountSqlite)
	do.Provide(i, func(i do.Injector) (*session.Manager, error) {
		return session.NewManager(do.MustInvoke[repository.Account](i)), nil
	})
	do.Provide(i, handlers.NewAccountHandler)
	do.Provide(i, handlers.NewFeedHandler)
	do.Provide(i, handlers.NewWSHandler)

	acc := do.MustInvoke[*handlers.AccountHandler](i)
	feed := do.MustInvoke[*handlers.FeedHandler](i)
	ws := do.MustInvoke[*handlers.WSHandler](i)

	r := gin.Default()

	api := r.Group("/api")
	{
		api.POST("/accounts", acc.Create)
		api.GET("/accounts/:id", acc.Get)
		api.PUT("/accounts/:id", acc.Update)
		api.DELETE("/accounts/:id", acc.Delete)
		api.GET("/accounts/:id/feed", feed.GetEpisodes)
		api.GET("/accounts/:id/ws", ws.Handle)
	}

	k, err := kama.New(uiFs, devProxy, kama.WithStaticPath("ui/out"))
	if err != nil {
		return oops.In("main").Wrapf(err, "initialize kama middleware")
	}
	r.Use(k.Gin())

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		slog.Info("starting server", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			err = oops.In("main").Wrapf(err, "http server")
			slog.Error("server error", slog.Any("error", err))
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh
	signal.Stop(sigCh)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func main() {
	addr := flag.String("addr", ":3000", "address to listen on")
	devProxy := flag.String("dev-proxy", "http://localhost:3001", "frontend dev server proxy")
	flag.Parse()

	if err := run(*addr, *devProxy); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}
