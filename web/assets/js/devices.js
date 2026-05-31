import { deactivateUserDevice, listDevices, listUserLocations, listAuthEvents } from "./api.js";
import { redirectToLogin } from "./auth.js";
import { getYandexMapsAPIKey } from "./config.js";
import { getLanguage, t } from "./i18n.js";
import { clearMap, createMap, fitToPoints, renderLocationPoints } from "./map.js";
import {
  clearChildren,
  el,
  formatCoordinate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  mapErrorMessage,
  setButtonPending,
  showToast,
} from "./ui.js";

const state = {
  limit: 20,
  offset: 0,
  platform: "all",
  active: "all",
  search: "",
  total: 0,
  isLoading: false,
  fetchSequence: 0,
};

let nodes = {};
let drawerMap = null;
let drawerMapState = "idle";
let activeDevice = null;

function mount(root) {
  nodes = {
    root,
    filters: root.querySelector("#devices-filters"),
    platform: root.querySelector("#devices-platform"),
    active: root.querySelector("#devices-active"),
    limit: root.querySelector("#devices-limit"),
    tbody: root.querySelector("#devices-tbody"),
    empty: root.querySelector("#devices-empty"),
    info: root.querySelector("#devices-info"),
    prev: root.querySelector("#devices-prev"),
    next: root.querySelector("#devices-next"),

    drawer: document.getElementById("device-drawer"),
    drawerClose: document.getElementById("device-drawer-close"),
    drawerOverview: document.getElementById("device-drawer-overview"),
    drawerDeactivate: document.getElementById("device-drawer-deactivate"),
    drawerLocations: document.getElementById("device-drawer-locations"),
    drawerAuth: document.getElementById("device-drawer-auth"),
    drawerMapCanvas: document.getElementById("device-drawer-map"),
    drawerMapState: document.getElementById("device-drawer-map-state"),
  };

  nodes.platform.addEventListener("change", () => {
    state.platform = nodes.platform.value;
    state.offset = 0;
    void load();
  });
  nodes.active.addEventListener("change", () => {
    state.active = nodes.active.value;
    state.offset = 0;
    void load();
  });
  nodes.limit.addEventListener("change", () => {
    state.limit = Number(nodes.limit.value) || 20;
    state.offset = 0;
    void load();
  });
  nodes.prev.addEventListener("click", () => {
    state.offset = Math.max(0, state.offset - state.limit);
    void load();
  });
  nodes.next.addEventListener("click", () => {
    if (state.offset + state.limit >= state.total) {
      return;
    }
    state.offset += state.limit;
    void load();
  });

  nodes.drawerClose.addEventListener("click", closeDrawer);
  nodes.drawer.addEventListener("click", (event) => {
    if (event.target === nodes.drawer) {
      closeDrawer();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nodes.drawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });
  nodes.drawerDeactivate.addEventListener("click", onDeactivate);

  document.addEventListener("languagechange", () => {
    updateInfo();
  });
}

function activate() {
  void load();
}

function onSearch(term) {
  state.search = String(term || "").trim();
  state.offset = 0;
  void load();
}

function activeParam() {
  if (state.active === "active") {
    return true;
  }
  if (state.active === "inactive") {
    return false;
  }
  return undefined;
}

async function load() {
  const requestID = ++state.fetchSequence;
  state.isLoading = true;
  renderSkeleton();
  nodes.prev.disabled = true;
  nodes.next.disabled = true;

  try {
    const response = await listDevices({
      limit: state.limit,
      offset: state.offset,
      platform: state.platform,
      active: activeParam(),
      search: state.search,
    });
    if (requestID !== state.fetchSequence) {
      return;
    }
    state.total = Number(response?.total ?? (response?.data || []).length) || 0;
    renderRows(response?.data || []);
  } catch (error) {
    if (requestID !== state.fetchSequence) {
      return;
    }
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    clearChildren(nodes.tbody);
    nodes.empty.hidden = false;
    showToast("error", mapErrorMessage(error, t));
  } finally {
    if (requestID === state.fetchSequence) {
      state.isLoading = false;
      updateInfo();
    }
  }
}

function renderSkeleton() {
  clearChildren(nodes.tbody);
  nodes.empty.hidden = true;
  for (let i = 0; i < 6; i += 1) {
    const row = el("tr", { class: "skeleton-row" });
    for (let c = 0; c < 10; c += 1) {
      row.appendChild(el("td", {}, [el("span", { class: "skeleton-bar" })]));
    }
    nodes.tbody.appendChild(row);
  }
}

function renderRows(devices) {
  clearChildren(nodes.tbody);
  if (!devices.length) {
    nodes.empty.hidden = false;
    return;
  }
  nodes.empty.hidden = true;
  const language = getLanguage();

  devices.forEach((device) => {
    const row = el("tr", { class: "clickable-row" }, [
      el("td", {}, [
        el("div", { class: "table-stack" }, [
          el("span", { class: "primary-text", text: device.phone_masked || t("common_na") }),
          el("span", { class: "muted-text mono", text: shorten(device.user_id) }),
        ]),
      ]),
      el("td", {}, [el("span", { class: `platform-tag platform-${device.platform || "unknown"}`, text: device.platform || "-" })]),
      el("td", { text: device.device_model || t("common_na") }),
      el("td", { text: device.manufacturer || t("common_na") }),
      el("td", { text: device.app_version || t("common_na") }),
      el("td", { text: device.os_version || t("common_na") }),
      el("td", {}, [
        el("span", {
          class: `mini-badge ${device.has_push_token ? "ok" : "muted"}`,
          text: device.has_push_token ? t("dev_push_yes") : t("dev_push_no"),
        }),
      ]),
      el("td", { text: formatRelativeTime(device.last_seen_at, language), title: formatDateTime(device.last_seen_at, language) }),
      el("td", {}, [statusChip(device.is_active)]),
      el("td", {}, [buildActions(device)]),
    ]);
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      openDrawer(device);
    });
    nodes.tbody.appendChild(row);
  });
}

function statusChip(isActive) {
  return el("span", {
    class: `status-chip ${isActive ? "is-active" : "is-inactive"}`,
    text: isActive ? t("status_active") : t("status_inactive"),
  });
}

function buildActions(device) {
  const wrap = el("div", { class: "table-actions" });
  const view = el("button", { class: "table-action", type: "button", text: t("dev_view") });
  view.addEventListener("click", (event) => {
    event.stopPropagation();
    openDrawer(device);
  });
  wrap.appendChild(view);
  if (device.is_active) {
    const deactivate = el("button", { class: "table-action danger", type: "button", text: t("dev_deactivate") });
    deactivate.addEventListener("click", (event) => {
      event.stopPropagation();
      void deactivateFromRow(device, deactivate);
    });
    wrap.appendChild(deactivate);
  }
  return wrap;
}

async function deactivateFromRow(device, button) {
  try {
    setButtonPending(button, true, `${t("dev_deactivate")}...`);
    await deactivateUserDevice(device.user_id, device.device_id);
    showToast("success", t("dev_deactivated_toast"));
    await load();
  } catch (error) {
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    showToast("error", mapErrorMessage(error, t));
    setButtonPending(button, false);
  }
}

function updateInfo() {
  const language = getLanguage();
  const start = state.total === 0 ? 0 : state.offset + 1;
  const end = Math.min(state.offset + state.limit, state.total);
  nodes.info.textContent = t("pagination_info", {
    start: formatNumber(start, language),
    end: formatNumber(end, language),
    total: formatNumber(state.total, language),
  });
  nodes.prev.disabled = state.isLoading || state.offset <= 0;
  nodes.next.disabled = state.isLoading || state.offset + state.limit >= state.total;
}

function shorten(value) {
  const v = String(value || "");
  return v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

// ---- details drawer -------------------------------------------------------

async function openDrawer(device) {
  activeDevice = device;
  nodes.drawer.classList.add("is-open");
  nodes.drawer.setAttribute("aria-hidden", "false");
  renderDrawerOverview(device);
  nodes.drawerDeactivate.hidden = !device.is_active;

  nodes.drawerLocations.innerHTML = "";
  nodes.drawerAuth.innerHTML = "";
  nodes.drawerLocations.appendChild(el("p", { class: "muted-text", text: t("common_loading") }));
  nodes.drawerAuth.appendChild(el("p", { class: "muted-text", text: t("common_loading") }));

  const [locations, authEvents] = await Promise.all([
    listUserLocations(device.user_id, { limit: 20 }).catch(() => ({ data: [] })),
    listAuthEvents({ userID: device.user_id, limit: 20 }).catch(() => ({ data: [] })),
  ]);

  const points = (locations?.data || []).filter((p) => p.latitude != null && p.longitude != null);
  renderDrawerLocations(locations?.data || []);
  renderDrawerAuth(authEvents?.data || []);
  await renderDrawerMap(points);
}

function closeDrawer() {
  nodes.drawer.classList.remove("is-open");
  nodes.drawer.setAttribute("aria-hidden", "true");
  activeDevice = null;
}

function renderDrawerOverview(device) {
  const language = getLanguage();
  clearChildren(nodes.drawerOverview);
  const rows = [
    [t("geo_point_phone"), device.phone_masked || t("common_na")],
    [t("geo_point_user"), device.user_id || t("common_na")],
    [t("geo_point_device"), device.device_id || t("common_na")],
    [t("dev_col_platform"), device.platform || t("common_na")],
    [t("dev_col_model"), device.device_model || t("common_na")],
    [t("dev_col_manufacturer"), device.manufacturer || t("common_na")],
    [t("dev_col_appver"), device.app_version || t("common_na")],
    [t("dev_col_osver"), device.os_version || t("common_na")],
    [t("dev_col_push"), device.has_push_token ? t("dev_push_yes") : t("dev_push_no")],
    [t("dev_col_first"), formatDateTime(device.first_seen_at, language)],
    [t("dev_col_last"), formatDateTime(device.last_seen_at, language)],
    [t("dev_col_status"), device.is_active ? t("status_active") : t("status_inactive")],
  ];
  rows.forEach(([label, value]) => {
    nodes.drawerOverview.appendChild(el("div", {}, [el("dt", { text: label }), el("dd", { class: "mono", text: value })]));
  });
}

function renderDrawerLocations(locations) {
  clearChildren(nodes.drawerLocations);
  if (!locations.length) {
    nodes.drawerLocations.appendChild(el("p", { class: "muted-text", text: t("dev_no_locations") }));
    return;
  }
  const language = getLanguage();
  locations.slice(0, 20).forEach((loc) => {
    nodes.drawerLocations.appendChild(
      el("div", { class: "drawer-list-item" }, [
        el("span", { class: "mono", text: formatCoordinate(loc.latitude, loc.longitude) }),
        el("span", { class: "mini-badge muted", text: loc.source || "-" }),
        el("span", { class: "recent-time", text: formatRelativeTime(loc.created_at, language) }),
      ]),
    );
  });
}

function renderDrawerAuth(events) {
  clearChildren(nodes.drawerAuth);
  if (!events.length) {
    nodes.drawerAuth.appendChild(el("p", { class: "muted-text", text: t("dev_no_auth") }));
    return;
  }
  const language = getLanguage();
  events.slice(0, 20).forEach((event) => {
    nodes.drawerAuth.appendChild(
      el("div", { class: "drawer-list-item" }, [
        el("span", { class: `event-chip event-${eventTone(event.event_type)}`, text: event.event_type || "-" }),
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

async function renderDrawerMap(points) {
  if (drawerMapState === "unavailable") {
    showDrawerMapOverlay(true);
    return;
  }
  if (!drawerMap) {
    try {
      drawerMap = await createMap(nodes.drawerMapCanvas, { apiKey: getYandexMapsAPIKey(), lang: getLanguage() });
      drawerMapState = "ok";
    } catch {
      drawerMapState = "unavailable";
      showDrawerMapOverlay(true);
      return;
    }
  }
  if (!points.length) {
    clearMap(drawerMap);
    showDrawerMapOverlay(true, t("dev_no_locations"));
    return;
  }
  showDrawerMapOverlay(false);
  renderLocationPoints(drawerMap, points);
  fitToPoints(drawerMap, points);
}

function showDrawerMapOverlay(show, message) {
  clearChildren(nodes.drawerMapState);
  nodes.drawerMapState.hidden = !show;
  if (show) {
    nodes.drawerMapState.appendChild(
      el("p", { class: "empty-copy", text: message || t("geo_map_unavailable_copy") }),
    );
  }
}

async function onDeactivate() {
  if (!activeDevice) {
    return;
  }
  try {
    setButtonPending(nodes.drawerDeactivate, true, `${t("dev_deactivate")}...`);
    await deactivateUserDevice(activeDevice.user_id, activeDevice.device_id);
    showToast("success", t("dev_deactivated_toast"));
    closeDrawer();
    await load();
  } catch (error) {
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    showToast("error", mapErrorMessage(error, t));
  } finally {
    setButtonPending(nodes.drawerDeactivate, false);
  }
}

export default {
  id: "devices",
  titleKey: "devices_title",
  subtitleKey: "devices_subtitle",
  searchable: true,
  searchPlaceholderKey: "dev_search_placeholder",
  mount,
  activate,
  onSearch,
};
