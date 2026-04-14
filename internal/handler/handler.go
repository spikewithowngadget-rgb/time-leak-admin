package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"time-leak-admin/config"
	"time-leak-admin/internal/service"
)

type Handler struct {
	cfg      config.Config
	service  *service.RuntimeConfigService
	logger   *slog.Logger
	staticFS http.Handler
}

func NewHandler(cfg config.Config, service *service.RuntimeConfigService, logger *slog.Logger) *Handler {
	assetsDir := filepath.Join(cfg.StaticDir, "assets")
	fileServer := http.FileServer(http.Dir(assetsDir))

	return &Handler{
		cfg:      cfg,
		service:  service,
		logger:   logger,
		staticFS: http.StripPrefix("/assets/", fileServer),
	}
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) RuntimeConfigJS(w http.ResponseWriter, _ *http.Request) {
	payload, err := h.service.RuntimeConfigJS()
	if err != nil {
		h.logger.Error("unable to build runtime config", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(payload))
}

func (h *Handler) PrivacyPolicy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	filePath := filepath.Clean(h.cfg.PrivacyPDFPath)

	file, err := os.Open(filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
			return
		}

		h.logger.Error("unable to open privacy pdf", "path", filePath, "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		h.logger.Error("unable to stat privacy pdf", "path", filePath, "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if info.IsDir() {
		http.NotFound(w, r)
		return
	}

	fileName := filepath.Base(filePath)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename="+strconv.Quote(fileName))
	w.Header().Set("Cache-Control", "public, max-age=3600")

	http.ServeContent(w, r, fileName, info.ModTime(), file)
}

func (h *Handler) LoginPage(w http.ResponseWriter, r *http.Request) {
	h.serveStaticPage(w, r, "login.html")
}

func (h *Handler) DashboardPage(w http.ResponseWriter, r *http.Request) {
	h.serveStaticPage(w, r, "index.html")
}

func (h *Handler) Assets(w http.ResponseWriter, r *http.Request) {
	h.staticFS.ServeHTTP(w, r)
}

func (h *Handler) NotFound(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

func (h *Handler) serveStaticPage(w http.ResponseWriter, r *http.Request, fileName string) {
	if strings.Contains(fileName, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(h.cfg.StaticDir, fileName)
	if _, err := os.Stat(filePath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
			return
		}

		h.logger.Error("unable to access static page", "path", filePath, "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.ServeFile(w, r, filePath)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}
}
