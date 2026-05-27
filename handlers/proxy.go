package handlers

import (
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
)

type ProxyHandler struct {
	client *http.Client
}

func NewProxyHandler(_ do.Injector) (*ProxyHandler, error) {
	return &ProxyHandler{
		client: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}, nil
}

func (h *ProxyHandler) Audio(c *gin.Context) {
	audioURL := c.Query("url")
	if audioURL == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	parsed, err := url.ParseRequestURI(audioURL)
	if err != nil || !parsed.IsAbs() {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, audioURL, nil)
	if err != nil {
		slog.Error("proxy create request", "url", audioURL, "error", err)
		c.AbortWithStatus(http.StatusBadGateway)
		return
	}

	// Forward Range header if present (for seeking support)
	if r := c.GetHeader("Range"); r != "" {
		req.Header.Set("Range", r)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		slog.Error("proxy fetch", "url", audioURL, "error", err)
		c.AbortWithStatus(http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for _, k := range []string{"Content-Type", "Content-Length", "Accept-Ranges", "Content-Range"} {
		if v := resp.Header.Get(k); v != "" {
			c.Header(k, v)
		}
	}

	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}
