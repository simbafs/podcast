package main

import (
	"embed"
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/simbafs/kama/v2"
	"podcast-sync/db"
	"podcast-sync/handler"
	"podcast-sync/player"
	ws "podcast-sync/ws"
)

//go:embed all:frontend/dist
var frontend embed.FS

func main() {
	dbPath := flag.String("db", "./data/podcast.db", "Database path")
	port := flag.String("port", "8080", "Server port")
	flag.Parse()

	if err := db.Init(*dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	pm := player.NewManager()
	hub := ws.NewHub(pm)
	go hub.Run()

	r := gin.Default()

	stateHandler := handler.NewStateHandler(pm)
	feedHandler := handler.NewFeedHandler(pm)

	r.GET("/api/state", stateHandler.GetState)
	r.POST("/api/feed", feedHandler.SaveFeed)
	r.POST("/api/takeover", feedHandler.Takeover)
	r.PATCH("/api/progress", feedHandler.UpdateProgress)

	r.GET("/ws", func(c *gin.Context) {
		hub.HandleWebSocket(c.Writer, c.Request)
	})

	r.GET("/api/proxy", func(c *gin.Context) {
		url := c.Query("url")
		if url == "" {
			c.JSON(400, gin.H{"error": "url required"})
			return
		}

		resp, err := http.Get(url)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		ct := resp.Header.Get("Content-Type")
		c.DataFromReader(resp.StatusCode, resp.ContentLength, ct, resp.Body, map[string]string{
			"Access-Control-Allow-Origin": "*",
		})
	})

	k, err := kama.New(frontend, "http://localhost:5173", kama.WithStaticPath("frontend/dist"))
	if err != nil {
		log.Fatalf("Failed to create kama: %v", err)
	}

	r.GET("/", func(c *gin.Context) {
		data, err := frontend.ReadFile("frontend/dist/index.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
	r.GET("/login", func(c *gin.Context) {
		data, err := frontend.ReadFile("frontend/dist/login.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
	r.GET("/assets/*filepath", gin.WrapH(k.Go()))
	r.GET("/icon.svg", gin.WrapH(k.Go()))

	addr := fmt.Sprintf(":%s", *port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
