package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
		PrivacyPDFPath:   filepath.Join(tempDir, "privacy.pdf"),
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
