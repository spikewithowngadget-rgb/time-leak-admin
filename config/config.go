package config

import (
	"os"
	"time"
)

const (
	defaultPort            = "8080"
	defaultAPIBaseURL      = "https://api.timeleak.kz"
	defaultStaticDir       = "web"
	defaultShutdownTimeout = 10 * time.Second
)

type Config struct {
	Port            string
	APIBaseURL      string
	StaticDir       string
	ShutdownTimeout time.Duration
}

func Load() Config {
	cfg := Config{
		Port:            getEnv("PORT", defaultPort),
		APIBaseURL:      getEnv("API_BASE_URL", defaultAPIBaseURL),
		StaticDir:       getEnv("STATIC_DIR", defaultStaticDir),
		ShutdownTimeout: defaultShutdownTimeout,
	}

	if raw := os.Getenv("SHUTDOWN_TIMEOUT_SECONDS"); raw != "" {
		if seconds, err := time.ParseDuration(raw + "s"); err == nil {
			cfg.ShutdownTimeout = seconds
		}
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
