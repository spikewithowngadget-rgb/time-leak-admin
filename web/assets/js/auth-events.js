import { listAuthEvents } from "./api.js";
import { redirectToLogin } from "./auth.js";
import { getLanguage, t } from "./i18n.js";
import {
  clearChildren,
  el,
  formatDateTime,
  formatNumber,
  mapErrorMessage,
  showToast,
} from "./ui.js";

const state = {
  limit: 20,
  offset: 0,
  eventType: "",
  phone: "",
  userID: "",
  total: 0,
  isLoading: false,
  fetchSequence: 0,
};

let nodes = {};

function mount(root) {
  nodes = {
    form: root.querySelector("#auth-filters"),
    eventType: root.querySelector("#auth-event-type"),
    phone: root.querySelector("#auth-phone"),
    user: root.querySelector("#auth-user"),
    reset: root.querySelector("#auth-reset"),
    tbody: root.querySelector("#auth-events-tbody"),
    empty: root.querySelector("#auth-events-empty"),
    info: root.querySelector("#auth-events-info"),
    prev: root.querySelector("#auth-prev"),
    next: root.querySelector("#auth-next"),
  };

  nodes.form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.eventType = nodes.eventType.value;
    state.phone = nodes.phone.value.trim();
    state.userID = nodes.user.value.trim();
    state.offset = 0;
    void load();
  });
  nodes.reset.addEventListener("click", () => {
    nodes.form.reset();
    state.eventType = "";
    state.phone = "";
    state.userID = "";
    state.offset = 0;
    void load();
  });
  nodes.prev.addEventListener("click", () => {
    state.offset = Math.max(0, state.offset - state.limit);
    void load();
  });
  nodes.next.addEventListener("click", () => {
    if (state.offset + state.limit > state.total) {
      return;
    }
    state.offset += state.limit;
    void load();
  });

  document.addEventListener("languagechange", updateInfo);
}

function activate() {
  void load();
}

async function load() {
  const requestID = ++state.fetchSequence;
  state.isLoading = true;
  renderSkeleton();
  nodes.prev.disabled = true;
  nodes.next.disabled = true;

  try {
    const response = await listAuthEvents({
      eventType: state.eventType,
      phone: state.phone,
      userID: state.userID,
      limit: state.limit,
      offset: state.offset,
    });
    if (requestID !== state.fetchSequence) {
      return;
    }
    const data = response?.data || [];
    // Backend total reflects the returned page size, so we infer paging from it.
    state.total = state.offset + data.length + (data.length === state.limit ? state.limit : 0);
    renderRows(data);
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
    for (let c = 0; c < 6; c += 1) {
      row.appendChild(el("td", {}, [el("span", { class: "skeleton-bar" })]));
    }
    nodes.tbody.appendChild(row);
  }
}

function renderRows(events) {
  clearChildren(nodes.tbody);
  if (!events.length) {
    nodes.empty.hidden = false;
    return;
  }
  nodes.empty.hidden = true;
  const language = getLanguage();

  events.forEach((event) => {
    const row = el("tr", {}, [
      el("td", {}, [el("span", { class: `event-chip event-${eventTone(event.event_type)}`, text: event.event_type || "-" })]),
      el("td", { text: event.phone_masked || t("common_na") }),
      el("td", {}, [el("span", { class: "mono", text: event.user_id || t("common_na") })]),
      el("td", { text: event.device_id || t("common_na") }),
      el("td", { text: event.ip_address || t("common_na") }),
      el("td", { text: formatDateTime(event.created_at, language), title: event.user_agent || "" }),
    ]);
    nodes.tbody.appendChild(row);
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

function updateInfo() {
  const language = getLanguage();
  const start = state.total === 0 ? 0 : state.offset + 1;
  const end = state.offset + Math.min(state.limit, Math.max(0, state.total - state.offset));
  nodes.info.textContent = `${formatNumber(start, language)}–${formatNumber(end, language)}`;
  nodes.prev.disabled = state.isLoading || state.offset <= 0;
  nodes.next.disabled = state.isLoading || state.offset + state.limit > state.total;
}

export default {
  id: "auth-events",
  titleKey: "auth_events_title",
  subtitleKey: "auth_events_subtitle",
  searchable: false,
  mount,
  activate,
};
