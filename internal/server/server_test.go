package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"time-leak-admin/config"
)

func TestSecurityHeadersAllowCrossOriginReferrerOrigin(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(tempDir, "index.html"), []byte("<!doctype html><title>ok</title>"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}

	srv := NewHTTPServer(config.Config{
		Port:             "0",
		StaticDir:        tempDir,
		APIBaseURL:       "https://api.test",
		YandexMapsAPIKey: "test-maps-key",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/dashboard", nil)
	rec := httptest.NewRecorder()

	srv.Handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
		t.Fatalf("unexpected Referrer-Policy: %q", got)
	}
}

func TestUserAppAndAdminRoutesStaySeparate(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "app", "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	for path, content := range map[string]string{
		"app/index.html":       "<!doctype html><title>User calendar</title>",
		"app/assets/client.js": "console.log('client')",
		"login.html":           "<!doctype html><title>Admin login</title>",
		"index.html":           "<!doctype html><title>Admin dashboard</title>",
		"privacy.html":         "<!doctype html><title>Privacy</title>",
	} {
		if err := os.WriteFile(filepath.Join(dir, path), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	srv := NewHTTPServer(config.Config{StaticDir: dir, APIBaseURL: "https://api.test"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	for _, tc := range []struct {
		path, contains string
		status         int
	}{
		{"/", "User calendar", 200},
		{"/?date=2027-03-14", "User calendar", 200},
		{"/login", "User calendar", 200},
		{"/register/verify", "User calendar", 200},
		{"/forgot-password/new", "User calendar", 200},
		{"/about", "User calendar", 200},
		{"/admin", "Admin login", 200},
		{"/admin/", "Admin login", 200},
		{"/admin/login", "Admin login", 200},
		{"/admin/dashboard", "Admin dashboard", 200},
		{"/dashboard", "Admin dashboard", 200},
		{"/privacy", "Privacy", 200},
		{"/app-assets/assets/client.js", "console.log", 200},
		{"/app-assets/assets/missing.js", "not found", 404},
		{"/app-assets/", "not found", 404},
		{"/app-assets/assets/", "not found", 404},
		{"/app-assets/index.html", "not found", 404},
		{"/api/missing", "not found", 404},
		{"/.well-known/assetlinks.json", "not found", 404},
		{"/admin/unknown", "not found", 404},
		{"/unknown", "not found", 404},
	} {
		t.Run(tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			srv.Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.contains) {
				t.Fatalf("status=%d, body=%q", rec.Code, rec.Body.String())
			}
		})
	}
	for _, path := range []string{"/login", "/app-assets/assets/client.js"} {
		rec := httptest.NewRecorder()
		srv.Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, nil))
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("POST %s got %d", path, rec.Code)
		}
	}
}
