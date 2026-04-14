package server

import (
	"log/slog"
	"net/http"
	"time"

	"time-leak-admin/config"
	"time-leak-admin/internal/handler"
	"time-leak-admin/internal/repository"
	"time-leak-admin/internal/service"
)

func NewHTTPServer(cfg config.Config, logger *slog.Logger) *http.Server {
	repo := repository.NewRuntimeConfigRepository(cfg.APIBaseURL)
	runtimeSvc := service.NewRuntimeConfigService(repo)
	h := handler.NewHandler(cfg, runtimeSvc, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/config.js", h.RuntimeConfigJS)
	mux.HandleFunc("/privacy", h.PrivacyPolicy)
	mux.HandleFunc("/login", h.LoginPage)
	mux.HandleFunc("/login.html", h.LoginPage)
	mux.HandleFunc("/dashboard", h.DashboardPage)
	mux.HandleFunc("/index.html", h.DashboardPage)
	mux.HandleFunc("/assets/", h.Assets)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			h.NotFound(w, r)
			return
		}

		h.LoginPage(w, r)
	})

	wrapped := loggingMiddleware(logger, securityHeadersMiddleware(mux))

	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           wrapped,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func loggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"remote", r.RemoteAddr,
			"duration", time.Since(startedAt),
		)
	})
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}
