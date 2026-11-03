package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"time-leak-admin/config"
)

func TestSharedAppPreservesMetadataStatusAndEscapesTitles(t *testing.T) {
	t.Parallel()
	for _, status := range []int{http.StatusOK, http.StatusGone, http.StatusNotFound} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/v1/notes/shared/abc123ABC_-9/landing" {
					t.Errorf("wrong metadata endpoint: %s", r.URL.Path)
				}
				data, _ := json.Marshal(sharedAppMetadata{Status: status, Title: `"/><script>alert(1)</script>{{danger}}`, Description: "A & B", Image: "https://timeleak.kz/preview?a=1&b=2", URL: "https://timeleak.kz/share/abc123ABC_-9"})
				_, _ = io.WriteString(w, base64.StdEncoding.EncodeToString(data))
			}))
			defer api.Close()
			dir := t.TempDir()
			if err := os.MkdirAll(filepath.Join(dir, "app"), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "app", "index.html"), []byte(`<!doctype html><html><head><title>TimeLeak</title><meta name="description" content="Default"><script type="module" src="/app-assets/assets/app.js"></script></head><body><div id="root"></div></body></html>`), 0o644); err != nil {
				t.Fatal(err)
			}
			h := newTestHandler(t, config.Config{StaticDir: dir, APIBaseURL: api.URL})
			rec := httptest.NewRecorder()
			h.UserApp(rec, httptest.NewRequest(http.MethodGet, "/share/abc123ABC_-9", nil))
			body := rec.Body.String()
			if rec.Code != status || !strings.Contains(body, `property="og:title"`) || !strings.Contains(body, `id="root"`) || !strings.Contains(body, `/app-assets/assets/app.js`) {
				t.Fatalf("status=%d body=%s", rec.Code, body)
			}
			if strings.Contains(body, "<script>alert(1)") || !strings.Contains(body, "&lt;script&gt;") || strings.Contains(body, `content="Default"`) {
				t.Fatalf("unsafe or stale metadata: %s", body)
			}
			if got := rec.Header().Get("Referrer-Policy"); got != "no-referrer" {
				t.Fatalf("share referrer policy: %s", got)
			}
			assertNoStore(t, rec.Result())
		})
	}
}

func TestSharedAppSurvivesInvalidMetadata(t *testing.T) {
	t.Parallel()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "invalid base64")
	}))
	defer api.Close()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "app"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app", "index.html"), []byte(`<html><head><title>TimeLeak</title></head><body><div id="root"></div></body></html>`), 0o644); err != nil {
		t.Fatal(err)
	}
	h := newTestHandler(t, config.Config{StaticDir: dir, APIBaseURL: api.URL})
	for _, tc := range []struct {
		path   string
		status int
	}{{"/share/abc123ABC_-9", 503}, {"/share/invalid", 404}} {
		rec := httptest.NewRecorder()
		h.UserApp(rec, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if rec.Code != tc.status || !strings.Contains(rec.Body.String(), `id="root"`) {
			t.Fatalf("%s status=%d body=%s", tc.path, rec.Code, rec.Body.String())
		}
	}
}
