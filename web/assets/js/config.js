const fallbackConfig = Object.freeze({
  API_BASE_URL: "https://api.timeleak.kz",
  // Supplied at runtime by GET /config.js (window.__APP_CONFIG__). Left empty
  // here on purpose so the key is not duplicated inside frontend modules.
  YANDEX_MAPS_API_KEY: "",
});

export function getRuntimeConfig() {
  const runtimeConfig = typeof window !== "undefined" && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : {};

  return {
    ...fallbackConfig,
    ...runtimeConfig,
  };
}

export function getYandexMapsAPIKey() {
  return String(getRuntimeConfig().YANDEX_MAPS_API_KEY || "").trim();
}
