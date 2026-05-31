import { getGeoAnalytics } from "./api.js";
import { redirectToLogin } from "./auth.js";
import { getYandexMapsAPIKey } from "./config.js";
import { getLanguage, t } from "./i18n.js";
import { clearMap, createMap, destroyMap, fitToPoints, MapError, renderLocationPoints } from "./map.js?v=20260531-yandex-v21";
import {
  clearChildren,
  closeDialog,
  el,
  formatDateTime,
  formatNumber,
  mapErrorMessage,
  openDialog,
  showToast,
} from "./ui.js";

let nodes = {};
let mapController = null;
let mapState = "idle"; // idle | ok | unavailable
let fetchSequence = 0;
let lastPoints = [];

function mount(root) {
  nodes = {
    form: root.querySelector("#geo-filters"),
    range: root.querySelector("#geo-range"),
    customFrom: root.querySelector("#geo-custom-from"),
    customTo: root.querySelector("#geo-custom-to"),
    fromInput: root.querySelector("#geo-from"),
    toInput: root.querySelector("#geo-to"),
    platform: root.querySelector("#geo-platform"),
    source: root.querySelector("#geo-source"),
    activeOnly: root.querySelector("#geo-active-only"),
    reset: root.querySelector("#geo-reset"),
    summary: root.querySelector("#geo-summary"),
    mapCanvas: root.querySelector("#geo-map"),
    mapStateBox: root.querySelector("#geo-map-state"),
    regionsBody: root.querySelector("#geo-regions-body"),
    regionsEmpty: root.querySelector("#geo-regions-empty"),
    pointDialog: document.getElementById("geo-point-dialog"),
    pointClose: document.getElementById("geo-point-close"),
    pointBody: document.getElementById("geo-point-body"),
  };

  nodes.range.addEventListener("change", syncCustomFields);
  nodes.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void load();
  });
  nodes.reset.addEventListener("click", () => {
    nodes.form.reset();
    nodes.range.value = "7";
    nodes.platform.value = "all";
    nodes.source.value = "all";
    nodes.activeOnly.checked = false;
    syncCustomFields();
    void load();
  });
  nodes.pointClose.addEventListener("click", () => closeDialog(nodes.pointDialog));
  nodes.pointDialog.addEventListener("click", (event) => {
    if (event.target === nodes.pointDialog) {
      closeDialog(nodes.pointDialog);
    }
  });

  document.addEventListener("languagechange", () => {
    syncCustomFields();
    renderSummary(lastSummary);
    renderRegions(lastRegions);
  });

  syncCustomFields();
}

let lastSummary = null;
let lastRegions = [];

function syncCustomFields() {
  const isCustom = nodes.range.value === "custom";
  nodes.customFrom.hidden = !isCustom;
  nodes.customTo.hidden = !isCustom;
}

async function activate() {
  await ensureMap();
  void load();
}

async function ensureMap() {
  if (mapController || mapState === "unavailable") {
    return;
  }
  const apiKey = getYandexMapsAPIKey();
  try {
    mapController = await createMap(nodes.mapCanvas, { apiKey, lang: getLanguage() });
    mapState = "ok";
    setMapOverlay(null);
  } catch (error) {
    mapController = null;
    mapState = "unavailable";
    setMapOverlay("unavailable", error);
  }
}

function setMapOverlay(kind, error) {
  clearChildren(nodes.mapStateBox);
  if (!kind) {
    nodes.mapStateBox.hidden = true;
    return;
  }
  nodes.mapStateBox.hidden = false;
  if (kind === "empty") {
    nodes.mapStateBox.appendChild(el("h3", { class: "empty-title", text: t("geo_map_empty_title") }));
    nodes.mapStateBox.appendChild(el("p", { class: "empty-copy", text: t("geo_map_empty_copy") }));
    return;
  }
  // unavailable
  const isMissingKey = error instanceof MapError && error.code === "missing_api_key";
  nodes.mapStateBox.appendChild(el("h3", { class: "empty-title", text: t("geo_map_unavailable_title") }));
  nodes.mapStateBox.appendChild(
    el("p", { class: "empty-copy", text: isMissingKey ? t("set_maps_missing") : t("geo_map_unavailable_copy") }),
  );
}

function rangeFrom(value) {
  if (value === "custom") {
    const raw = (nodes.fromInput.value || "").trim();
    return raw ? `${raw}T00:00:00Z` : "";
  }
  if (value === "1") {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = Number(value) || 7;
  return new Date(Date.now() - days * 86400000).toISOString();
}

function rangeTo(value) {
  if (value === "custom") {
    const raw = (nodes.toInput.value || "").trim();
    return raw ? `${raw}T23:59:59Z` : "";
  }
  return "";
}

async function load() {
  const requestID = ++fetchSequence;
  const range = nodes.range.value;
  nodes.summary.classList.add("is-busy");

  try {
    const result = await getGeoAnalytics({
      from: rangeFrom(range),
      to: rangeTo(range),
      platform: nodes.platform.value,
      source: nodes.source.value,
      active: nodes.activeOnly.checked,
      limit: 1000,
    });
    if (requestID !== fetchSequence) {
      return;
    }

    lastSummary = result?.summary || null;
    lastRegions = result?.regions || [];
    lastPoints = result?.points || [];

    renderSummary(lastSummary);
    renderRegions(lastRegions);
    updateMap(lastPoints);
  } catch (error) {
    if (requestID !== fetchSequence) {
      return;
    }
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    showToast("error", mapErrorMessage(error, t));
  } finally {
    if (requestID === fetchSequence) {
      nodes.summary.classList.remove("is-busy");
    }
  }
}

function summaryCard(labelKey, value) {
  const language = getLanguage();
  return el("article", { class: "stat-card" }, [
    el("p", { class: "stat-label", text: t(labelKey) }),
    el("p", { class: "stat-value", text: typeof value === "number" ? formatNumber(value, language) : value }),
  ]);
}

function renderSummary(summary) {
  clearChildren(nodes.summary);
  const s = summary || {};
  const topRegion = s.top_region ? s.top_region : t("common_na");
  nodes.summary.appendChild(summaryCard("geo_sum_events", s.total_events || 0));
  nodes.summary.appendChild(summaryCard("geo_sum_users", s.unique_users || 0));
  nodes.summary.appendChild(summaryCard("geo_sum_devices", s.unique_devices || 0));
  nodes.summary.appendChild(summaryCard("geo_sum_ios", s.ios_devices || 0));
  nodes.summary.appendChild(summaryCard("geo_sum_android", s.android_devices || 0));
  nodes.summary.appendChild(summaryCard("geo_sum_top_region", topRegion));
}

function renderRegions(regions) {
  clearChildren(nodes.regionsBody);
  if (!regions || regions.length === 0) {
    nodes.regionsEmpty.hidden = false;
    return;
  }
  nodes.regionsEmpty.hidden = true;
  const language = getLanguage();

  regions.forEach((region) => {
    const nameCell = el("td", {}, [
      el("div", { class: "region-name" }, [
        document.createTextNode(region.name || t("common_na")),
        region.approximate ? el("span", { class: "mini-badge", text: t("region_approx_badge") }) : null,
      ]),
    ]);
    const row = el("tr", {}, [
      nameCell,
      el("td", { text: formatNumber(region.count || 0, language) }),
      el("td", { text: formatNumber(region.unique_users || 0, language) }),
      el("td", {}, [el("span", { class: "share-pill", text: `${Number(region.percentage || 0).toFixed(1)}%` })]),
      el("td", { text: formatDateTime(region.last_seen_at, language) }),
    ]);
    nodes.regionsBody.appendChild(row);
  });
}

function updateMap(points) {
  if (mapState !== "ok" || !mapController) {
    // Map could not be created; region stats remain visible.
    return;
  }
  if (!points || points.length === 0) {
    clearMap(mapController);
    setMapOverlay("empty");
    return;
  }
  setMapOverlay(null);
  renderLocationPoints(mapController, points, openPointDialog);
  fitToPoints(mapController, points);
}

function openPointDialog(point) {
  const language = getLanguage();
  clearChildren(nodes.pointBody);
  const rows = [
    [t("geo_point_user"), point.user_id || t("common_na")],
    [t("geo_point_phone"), point.phone_masked || t("common_na")],
    [t("geo_point_device"), point.device_id || t("common_na")],
    [t("geo_point_platform"), point.platform || t("common_na")],
    [t("geo_point_model"), point.device_model || t("common_na")],
    [t("geo_point_source"), point.source || t("common_na")],
    [t("geo_point_time"), formatDateTime(point.created_at, language)],
    [t("geo_point_coords"), `${Number(point.latitude).toFixed(4)}, ${Number(point.longitude).toFixed(4)}`],
  ];
  rows.forEach(([label, value]) => {
    nodes.pointBody.appendChild(
      el("div", {}, [el("dt", { text: label }), el("dd", { class: "mono", text: value })]),
    );
  });
  openDialog(nodes.pointDialog);
}

function deactivate() {
  // Keep the map instance alive across tab switches to avoid recreating it.
  // (No teardown required when simply navigating away.)
}

export default {
  id: "geo",
  titleKey: "geo_title",
  subtitleKey: "geo_subtitle",
  searchable: false,
  mount,
  activate,
  deactivate,
  destroy() {
    if (mapController) {
      destroyMap(mapController);
      mapController = null;
      mapState = "idle";
    }
  },
};
