package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var (
	shareTokenPattern      = regexp.MustCompile(`^[A-Za-z0-9_-]{12}$`)
	pageTitlePattern       = regexp.MustCompile(`(?is)<title>.*?</title>`)
	pageDescriptionPattern = regexp.MustCompile(`(?is)<meta\s+name=["']description["'][^>]*>`)
)

// The existing public landing envelope is intentionally reused here so preview
// crawlers get the same signed preview and status as the mobile share links.
type sharedAppMetadata struct {
	Status      int
	Title       string
	Description string
	Image       string
	URL         string
}

func (h *Handler) serveSharedApp(w http.ResponseWriter, r *http.Request) {
	content, err := os.ReadFile(filepath.Join(h.cfg.StaticDir, "app", "index.html"))
	if err != nil {
		h.NotFound(w, r)
		return
	}
	page := sharedAppMetadata{Status: http.StatusNotFound, Title: "TimeLeak", Description: "Заметка не найдена"}
	token := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/share/"), "/")
	if shareTokenPattern.MatchString(token) {
		if metadata, ok := h.loadSharedAppMetadata(r, token); ok {
			page = metadata
		} else {
			page.Status = http.StatusServiceUnavailable
			page.Description = "Не удалось загрузить заметку"
		}
	}
	// Escape every value as HTML data. User titles are never template source.
	title := []byte("<title>" + html.EscapeString(page.Title) + " — TimeLeak</title>")
	content = pageTitlePattern.ReplaceAllFunc(content, func([]byte) []byte { return title })
	content = pageDescriptionPattern.ReplaceAll(content, nil)
	var metadata bytes.Buffer
	fmt.Fprintf(&metadata, `<meta name="description" content="%s"><meta name="robots" content="noindex, nofollow"><meta property="og:type" content="article"><meta property="og:site_name" content="TimeLeak"><meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta name="twitter:card" content="summary_large_image">`, html.EscapeString(page.Description), html.EscapeString(page.Title), html.EscapeString(page.Description))
	if page.Image != "" {
		fmt.Fprintf(&metadata, `<meta property="og:image" content="%s"><meta property="og:image:width" content="600"><meta property="og:image:height" content="315">`, html.EscapeString(page.Image))
	}
	if page.URL != "" {
		fmt.Fprintf(&metadata, `<meta property="og:url" content="%s"><link rel="canonical" href="%s">`, html.EscapeString(page.URL), html.EscapeString(page.URL))
	}
	metadata.WriteString("</head>")
	content = bytes.Replace(content, []byte("</head>"), metadata.Bytes(), 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Referrer-Policy", "no-referrer")
	setNoStoreHeaders(w)
	w.WriteHeader(page.Status)
	if r.Method != http.MethodHead {
		_, _ = w.Write(content)
	}
}

func (h *Handler) loadSharedAppMetadata(r *http.Request, token string) (sharedAppMetadata, bool) {
	var page sharedAppMetadata
	endpoint, err := url.JoinPath(h.cfg.APIBaseURL, "api/v1/notes/shared", token, "landing")
	if err != nil {
		return page, false
	}
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		return page, false
	}
	response, err := (&http.Client{Timeout: 3 * time.Second}).Do(request)
	if err != nil {
		return page, false
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return page, false
	}
	encoded, err := io.ReadAll(io.LimitReader(response.Body, 128<<10))
	if err != nil {
		return page, false
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(encoded)))
	if err != nil || json.Unmarshal(decoded, &page) != nil {
		return page, false
	}
	switch page.Status {
	case http.StatusOK, http.StatusNotFound, http.StatusGone, http.StatusServiceUnavailable:
		return page, true
	}
	return page, false
}
