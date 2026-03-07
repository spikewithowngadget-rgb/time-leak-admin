const fallbackConfig = Object.freeze({
  API_BASE_URL: "https://api.timeleak.kz",
});

export function getRuntimeConfig() {
  const runtimeConfig = typeof window !== "undefined" && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : {};

  return {
    ...fallbackConfig,
    ...runtimeConfig,
  };
}
