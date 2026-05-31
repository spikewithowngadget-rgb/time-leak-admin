import { getSessionUser, logout, requireAuthOrRedirect } from "./auth.js";
import { applyTranslations, getLanguage, initLanguageSelect, t } from "./i18n.js";
import { debounce } from "./ui.js";

import overview from "./overview.js";
import ads from "./ads.js";
import geo from "./analytics.js";
import devices from "./devices.js";
import authEvents from "./auth-events.js";
import settings from "./settings.js";

const sections = {
  overview,
  ads,
  geo,
  devices,
  "auth-events": authEvents,
  settings,
};
const DEFAULT_VIEW = "overview";

const mounted = new Set();
const searchTerms = {};
let currentID = "";

const dom = {};

boot();

function boot() {
  if (!requireAuthOrRedirect()) {
    return;
  }

  dom.sidebar = document.getElementById("sidebar");
  dom.backdrop = document.getElementById("drawer-backdrop");
  dom.menuToggle = document.getElementById("menu-toggle");
  dom.viewStack = document.getElementById("view-stack");
  dom.viewTitle = document.getElementById("view-title");
  dom.viewSubtitle = document.getElementById("view-subtitle");
  dom.searchField = document.getElementById("search-field");
  dom.searchInput = document.getElementById("search-input");
  dom.languageSelect = document.getElementById("language-select");
  dom.logoutButton = document.getElementById("logout-button");
  dom.sessionBadge = document.getElementById("session-user-badge");
  dom.sessionAvatar = document.getElementById("session-avatar");
  dom.navItems = Array.from(document.querySelectorAll(".nav-item[data-nav]"));

  initLanguageSelect(dom.languageSelect);
  applyTranslations(document);
  hydrateSession();
  bindShell();

  route(resolveInitialView(), { replace: true });
}

function resolveInitialView() {
  const hash = (window.location.hash || "").replace(/^#/, "");
  return sections[hash] ? hash : DEFAULT_VIEW;
}

function hydrateSession() {
  const user = getSessionUser();
  dom.sessionBadge.textContent = user;
  dom.sessionAvatar.textContent = (user || "A").trim().charAt(0).toUpperCase() || "A";
}

function bindShell() {
  dom.logoutButton.addEventListener("click", logout);

  dom.navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      route(item.dataset.nav);
    });
  });

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    link.addEventListener("click", () => route(link.dataset.navLink));
  });

  dom.menuToggle.addEventListener("click", () => toggleDrawer());
  dom.backdrop.addEventListener("click", () => toggleDrawer(false));

  const onSearch = debounce((value) => {
    const section = sections[currentID];
    if (section && typeof section.onSearch === "function") {
      searchTerms[currentID] = value;
      section.onSearch(value);
    }
  }, 280);
  dom.searchInput.addEventListener("input", (event) => onSearch(event.target.value));

  window.addEventListener("hashchange", () => {
    const id = (window.location.hash || "").replace(/^#/, "");
    if (sections[id] && id !== currentID) {
      route(id);
    }
  });

  document.addEventListener("languagechange", () => {
    updateTopbar(sections[currentID]);
    hydrateSession();
  });
}

function toggleDrawer(force) {
  const open = force === undefined ? !dom.sidebar.classList.contains("is-open") : force;
  dom.sidebar.classList.toggle("is-open", open);
  dom.backdrop.hidden = !open;
}

function route(id, { replace = false } = {}) {
  const section = sections[id] || sections[DEFAULT_VIEW];
  const resolvedID = sections[id] ? id : DEFAULT_VIEW;
  currentID = resolvedID;

  // Toggle nav active state.
  dom.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.nav === resolvedID);
  });

  // Show the matching view, hide the rest.
  let viewEl = null;
  dom.viewStack.querySelectorAll(".view").forEach((view) => {
    const match = view.dataset.view === resolvedID;
    view.hidden = !match;
    if (match) {
      viewEl = view;
    }
  });

  updateTopbar(section);

  if (viewEl && !mounted.has(resolvedID)) {
    section.mount(viewEl);
    mounted.add(resolvedID);
  }
  if (typeof section.activate === "function") {
    section.activate();
  }

  // Reflect the section's stored search term in the shared input.
  if (section.searchable) {
    dom.searchInput.value = searchTerms[resolvedID] || "";
  }

  // Update the URL hash without scrolling.
  const targetHash = `#${resolvedID}`;
  if (window.location.hash !== targetHash) {
    if (replace) {
      window.history.replaceState(null, "", targetHash);
    } else {
      window.history.pushState(null, "", targetHash);
    }
  }

  // Close the mobile drawer after navigating.
  toggleDrawer(false);
  dom.viewStack.scrollTo?.({ top: 0 });
}

function updateTopbar(section) {
  if (!section) {
    return;
  }
  dom.viewTitle.textContent = t(section.titleKey);
  dom.viewSubtitle.textContent = section.subtitleKey ? t(section.subtitleKey) : "";

  if (section.searchable) {
    dom.searchField.hidden = false;
    if (section.searchPlaceholderKey) {
      dom.searchInput.setAttribute("placeholder", t(section.searchPlaceholderKey));
    }
  } else {
    dom.searchField.hidden = true;
  }
}
