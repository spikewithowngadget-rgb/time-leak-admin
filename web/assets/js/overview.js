import { getAnalyticsOverview, listAuthEvents } from "./api.js";
import { redirectToLogin } from "./auth.js";
import { getLanguage, t } from "./i18n.js";
import {
  clearChildren,
  el,
  emptyState,
  errorState,
  formatNumber,
  formatRelativeTime,
  loadingState,
} from "./ui.js";

let nodes = {};
let loadedOnce = false;

function mount(root) {
  nodes = {
    state: root.querySelector("#overview-state"),
    content: root.querySelector("#overview-content"),
    stats: root.querySelector("#overview-stats"),
    recent: root.querySelector("#overview-recent"),
  };
  document.addEventListener("languagechange", () => {
    if (loadedOnce) {
      void load();
    }
  });
}

function activate() {
  void load();
}

function showState(node) {
  clearChildren(nodes.state);
  if (!node) {
    nodes.state.hidden = true;
    nodes.content.hidden = false;
    return;
  }
  nodes.state.appendChild(node);
  nodes.state.hidden = false;
  nodes.content.hidden = true;
}

async function load() {
  if (!loadedOnce) {
    showState(loadingState(t("common_loading")));
  }
  try {
    const [overview, authEvents] = await Promise.all([
      getAnalyticsOverview(),
      listAuthEvents({ limit: 6 }).catch(() => ({ data: [] })),
    ]);
    loadedOnce = true;
    showState(null);
    renderStats(overview);
    renderRecent(authEvents?.data || []);
  } catch (error) {
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    showState(errorState(t("common_error_title"), t("common_error_copy"), t("common_retry"), () => void load()));
  }
}

function statCard(labelKey, value, groupKey) {
  const language = getLanguage();
  return el("article", { class: "stat-card" }, [
    el("p", { class: "stat-tag", text: t(groupKey) }),
    el("p", { class: "stat-label", text: t(labelKey) }),
    el("p", { class: "stat-value", text: formatNumber(value, language) }),
  ]);
}

function renderStats(overview) {
  const ads = overview?.ads || {};
  const devices = overview?.devices || {};
  const locations = overview?.locations || {};

  clearChildren(nodes.stats);
  const cards = [
    statCard("ov_ads_total", ads.total || 0, "ov_ads_group"),
    statCard("ov_ads_active", ads.active || 0, "ov_ads_group"),
    statCard("ov_ads_inactive", ads.inactive || 0, "ov_ads_group"),
    statCard("ov_dev_total", devices.total || 0, "ov_devices_group"),
    statCard("ov_dev_ios", devices.ios || 0, "ov_devices_group"),
    statCard("ov_dev_android", devices.android || 0, "ov_devices_group"),
    statCard("ov_dev_active", devices.active || 0, "ov_devices_group"),
    statCard("ov_loc_total", locations.total || 0, "ov_locations_group"),
    statCard("ov_loc_users", locations.unique_users || 0, "ov_locations_group"),
    statCard("ov_loc_devices", locations.unique_devices || 0, "ov_locations_group"),
  ];
  cards.forEach((card) => nodes.stats.appendChild(card));
}

function renderRecent(events) {
  clearChildren(nodes.recent);
  if (!events.length) {
    nodes.recent.appendChild(emptyState(t("common_no_data_title"), t("dev_no_auth")));
    return;
  }
  const language = getLanguage();
  events.forEach((event) => {
    nodes.recent.appendChild(
      el("div", { class: "recent-item" }, [
        el("span", { class: `event-chip event-${eventTone(event.event_type)}`, text: event.event_type || "-" }),
        el("span", { class: "recent-phone", text: event.phone_masked || t("common_na") }),
        el("span", { class: "recent-time", text: formatRelativeTime(event.created_at, language) }),
      ]),
    );
  });
}

function eventTone(type) {
  if (!type) {
    return "neutral";
  }
  if (type.includes("failed")) {
    return "danger";
  }
  if (type.includes("success")) {
    return "success";
  }
  return "neutral";
}

export default {
  id: "overview",
  titleKey: "overview_title",
  subtitleKey: "overview_subtitle",
  searchable: false,
  mount,
  activate,
};
