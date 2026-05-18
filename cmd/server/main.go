package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"podcast-sync/internal/db"
	"podcast-sync/internal/handler"
	"podcast-sync/internal/player"
	ws "podcast-sync/internal/ws"
)

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

	dir, _ := os.Getwd()
	frontendDir := dir + "/frontend"
	if _, err := os.Stat(frontendDir); err == nil {
		r.Static("/static", frontendDir)
		r.GET("/", func(c *gin.Context) {
			c.File(frontendDir + "/index.html")
		})
	}

	addr := fmt.Sprintf(":%s", *port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}