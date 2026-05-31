import { logout, getSessionUser } from "./auth.js";
import { getRuntimeConfig, getYandexMapsAPIKey } from "./config.js";
import { getLanguage, setLanguage, t } from "./i18n.js";

let nodes = {};

function mount(root) {
  nodes = {
    user: root.querySelector("#set-session-user"),
    apiBase: root.querySelector("#set-api-base"),
    mapsStatus: root.querySelector("#set-maps-status"),
    language: root.querySelector("#settings-language"),
    logout: root.querySelector("#settings-logout"),
  };

  nodes.language.value = getLanguage();
  nodes.language.addEventListener("change", () => setLanguage(nodes.language.value));
  nodes.logout.addEventListener("click", logout);

  document.addEventListener("languagechange", () => {
    nodes.language.value = getLanguage();
    render();
  });
}

function activate() {
  render();
}

function render() {
  const config = getRuntimeConfig();
  nodes.user.textContent = getSessionUser();
  nodes.apiBase.textContent = config.API_BASE_URL || "-";
  const configured = getYandexMapsAPIKey().length > 0;
  nodes.mapsStatus.textContent = configured ? t("set_maps_configured") : t("set_maps_missing");
  nodes.mapsStatus.className = configured ? "status-chip is-active" : "status-chip is-inactive";
  nodes.language.value = getLanguage();
}

export default {
  id: "settings",
  titleKey: "settings_title",
  subtitleKey: "settings_subtitle",
  searchable: false,
  mount,
  activate,
};
