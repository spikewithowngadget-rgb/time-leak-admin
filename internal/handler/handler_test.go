package handler

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
	"time-leak-admin/internal/repository"
	"time-leak-admin/internal/service"
)

func TestPrivacyPolicyServesInlinePDF(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	pdfPath := filepath.Join(tempDir, "privacy.pdf")
	pdfPayload := []byte("%PDF-1.4\nfake pdf payload")

	if err := os.WriteFile(pdfPath, pdfPayload, 0o644); err != nil {
		t.Fatalf("write pdf: %v", err)
	}

	h := newTestHandler(t, config.Config{
		StaticDir:      tempDir,
		PrivacyPDFPath: pdfPath,
	})

	req := httptest.NewRequest(http.MethodGet, "/privacy", nil)
	rec := httptest.NewRecorder()

	h.PrivacyPolicy(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.StatusCode)
	}

	if got := res.Header.Get("Content-Type"); !strings.HasPrefix(got, "application/pdf") {
		t.Fatalf("expected pdf content type, got %q", got)
	}

	if got := res.Header.Get("Content-Disposition"); got != `inline; filename="privacy.pdf"` {
		t.Fatalf("unexpected content disposition: %q", got)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if string(body) != string(pdfPayload) {
		t.Fatalf("unexpected body: %q", string(body))
	}
}

func TestPrivacyPolicyReturns404WhenFileMissing(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	h := newTestHandler(t, config.Config{
		StaticDir:      tempDir,
		PrivacyPDFPath: filepath.Join(tempDir, "missing.pdf"),
	})

	req := httptest.NewRequest(http.MethodGet, "/privacy", nil)
	rec := httptest.NewRecorder()

	h.PrivacyPolicy(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestStaticPageDisablesCache(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(tempDir, "index.html"), []byte("<!doctype html><title>ok</title>"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}

	h := newTestHandler(t, config.Config{
		StaticDir:      tempDir,
		PrivacyPDFPath: filepath.Join(tempDir, "privacy.pdf"),
	})

	req := httptest.NewRequest(http.MethodGet, "/dashboard", nil)
	rec := httptest.NewRecorder()

	h.DashboardPage(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	assertNoStore(t, rec.Result())
}

func TestAssetsDisableCache(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	assetDir := filepath.Join(tempDir, "assets", "css")
	if err := os.MkdirAll(assetDir, 0o755); err != nil {
		t.Fatalf("mkdir assets: %v", err)
	}
	if err := os.WriteFile(filepath.Join(assetDir, "styles.css"), []byte("body{margin:0}"), 0o644); err != nil {
		t.Fatalf("write css: %v", err)
	}

	h := newTestHandler(t, config.Config{
		StaticDir:      tempDir,
		PrivacyPDFPath: filepath.Join(tempDir, "privacy.pdf"),
	})

	req := httptest.NewRequest(http.MethodGet, "/assets/css/styles.css", nil)
	rec := httptest.NewRecorder()

	h.Assets(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	assertNoStore(t, rec.Result())
}

func newTestHandler(t *testing.T, cfg config.Config) *Handler {
	t.Helper()

	repo := repository.NewRuntimeConfigRepository("https://api.test", "test-maps-key")
	svc := service.NewRuntimeConfigService(repo)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	return NewHandler(cfg, svc, logger)
}

func assertNoStore(t *testing.T, res *http.Response) {
	t.Helper()
	defer res.Body.Close()

	cacheControl := res.Header.Get("Cache-Control")
	if !strings.Contains(cacheControl, "no-store") || !strings.Contains(cacheControl, "max-age=0") {
		t.Fatalf("unexpected Cache-Control: %q", cacheControl)
	}
	if got := res.Header.Get("Pragma"); got != "no-cache" {
		t.Fatalf("unexpected Pragma: %q", got)
	}
	if got := res.Header.Get("Expires"); got != "0" {
		t.Fatalf("unexpected Expires: %q", got)
	}
}
