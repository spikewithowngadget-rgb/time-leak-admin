package config

import (
	"os"
	"time"
)

const (
	defaultPort            = "8080"
	defaultAPIBaseURL      = "https://api.timeleak.kz"
	defaultStaticDir       = "web"
	defaultPrivacyPDFPath  = "offerta/time-leak-offerta.pdf"
	defaultShutdownTimeout = 10 * time.Second
	// defaultYandexMapsAPIKey is the project Yandex Maps JavaScript API key. It is a
	// browser-side key (already exposed to clients via the map script URL) and
	// can be overridden per-environment with YANDEX_MAPS_API_KEY.
	defaultYandexMapsAPIKey = "adad526e-4686-40e0-9664-f019d19a6ede"
)

type Config struct {
	Port             string
	APIBaseURL       string
	StaticDir        string
	PrivacyPDFPath   string
	YandexMapsAPIKey string
	ShutdownTimeout  time.Duration
}

func Load() Config {
	cfg := Config{
		Port:             getEnv("PORT", defaultPort),
		APIBaseURL:       getEnv("API_BASE_URL", defaultAPIBaseURL),
		StaticDir:        getEnv("STATIC_DIR", defaultStaticDir),
		PrivacyPDFPath:   getEnv("PRIVACY_PDF_PATH", defaultPrivacyPDFPath),
		YandexMapsAPIKey: getEnv("YANDEX_MAPS_API_KEY", defaultYandexMapsAPIKey),
		ShutdownTimeout:  defaultShutdownTimeout,
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
