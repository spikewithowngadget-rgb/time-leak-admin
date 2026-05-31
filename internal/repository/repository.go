package repository

type RuntimeConfigRepository struct {
	apiBaseURL       string
	yandexMapsAPIKey string
}

func NewRuntimeConfigRepository(apiBaseURL, yandexMapsAPIKey string) *RuntimeConfigRepository {
	return &RuntimeConfigRepository{
		apiBaseURL:       apiBaseURL,
		yandexMapsAPIKey: yandexMapsAPIKey,
	}
}

func (r *RuntimeConfigRepository) APIBaseURL() string {
	return r.apiBaseURL
}

func (r *RuntimeConfigRepository) YandexMapsAPIKey() string {
	return r.yandexMapsAPIKey
}
