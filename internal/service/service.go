package service

import (
	"encoding/json"
	"fmt"

	"time-leak-admin/internal/repository"
)

type RuntimeConfigService struct {
	repo *repository.RuntimeConfigRepository
}

func NewRuntimeConfigService(repo *repository.RuntimeConfigRepository) *RuntimeConfigService {
	return &RuntimeConfigService{repo: repo}
}

func (s *RuntimeConfigService) RuntimeConfigJS() (string, error) {
	cfg := struct {
		APIBaseURL string `json:"API_BASE_URL"`
	}{
		APIBaseURL: s.repo.APIBaseURL(),
	}

	encoded, err := json.Marshal(cfg)
	if err != nil {
		return "", fmt.Errorf("marshal runtime config: %w", err)
	}

	return "window.__APP_CONFIG__ = Object.freeze(" + string(encoded) + ");", nil
}
