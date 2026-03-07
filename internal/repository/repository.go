package repository

type RuntimeConfigRepository struct {
	apiBaseURL string
}

func NewRuntimeConfigRepository(apiBaseURL string) *RuntimeConfigRepository {
	return &RuntimeConfigRepository{apiBaseURL: apiBaseURL}
}

func (r *RuntimeConfigRepository) APIBaseURL() string {
	return r.apiBaseURL
}
