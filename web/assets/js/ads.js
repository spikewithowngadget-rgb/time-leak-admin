import { createAd, deleteAd, listAds, updateAd } from "./api.js";
import { getSessionUser, logout, redirectToLogin, requireAuthOrRedirect } from "./auth.js";
import { applyTranslations, getLanguage, initLanguageSelect, t } from "./i18n.js";
import { clearChildren, closeDialog, copyText, formatDateTime, formatNumber, hostnameFromURL, isValidHttpURL, mapErrorMessage, openDialog, setButtonPending, showToast } from "./ui.js";

const state = {
  limit: 10,
  offset: 0,
  activeFilter: "all",
  total: 0,
  ads: [],
  visibleAds: [],
  searchTerm: "",
  isLoading: true,
  selectedAdID: "",
  editorMode: "create",
  editingAd: null,
  deletingAd: null,
  fetchSequence: 0,
};

const elements = {
  languageSelect: document.getElementById("language-select"),
  logoutButton: document.getElementById("logout-button"),
  searchInput: document.getElementById("search-input"),

  statTotal: document.getElementById("stat-total"),
  statLoaded: document.getElementById("stat-loaded"),
  statActive: document.getElementById("stat-active"),
  statInactive: document.getElementById("stat-inactive"),

  sessionUserBadge: document.getElementById("session-user-badge"),

  tablePanel: document.querySelector(".table-panel"),
  tablePanelSummary: document.getElementById("table-panel-summary"),
  refreshButton: document.getElementById("refresh-button"),
  openCreateButton: document.getElementById("open-create-dialog"),
  openCreateEmptyButton: document.getElementById("open-create-empty"),
  filterSelect: document.getElementById("active-filter"),
  limitSelect: document.getElementById("limit-select"),
  tableBody: document.getElementById("ads-table-body"),
  tableEmpty: document.getElementById("table-empty"),
  paginationInfo: document.getElementById("pagination-info"),
  prevButton: document.getElementById("prev-page"),
  nextButton: document.getElementById("next-page"),
  offsetInput: document.getElementById("offset-input"),
  offsetApply: document.getElementById("offset-apply"),

  inspectorEmpty: document.getElementById("inspector-empty"),
  inspectorCard: document.getElementById("inspector-card"),
  inspectorMedia: document.getElementById("inspector-media"),
  inspectorImage: document.getElementById("inspector-image"),
  inspectorFallback: document.getElementById("inspector-fallback"),
  inspectorTitle: document.getElementById("inspector-title"),
  inspectorID: document.getElementById("inspector-id"),
  inspectorTarget: document.getElementById("inspector-target"),
  inspectorImageLink: document.getElementById("inspector-image-link"),
  inspectorStatus: document.getElementById("inspector-status"),
  inspectorStatusText: document.getElementById("inspector-status-text"),
  inspectorCreated: document.getElementById("inspector-created"),
  inspectorUpdated: document.getElementById("inspector-updated"),
  inspectorCopyLink: document.getElementById("inspector-copy-link"),
  inspectorEdit: document.getElementById("inspector-edit"),
  inspectorDelete: document.getElementById("inspector-delete"),

  editorDialog: document.getElementById("editor-dialog"),
  editorTitle: document.getElementById("editor-title"),
  editorSubtitle: document.getElementById("editor-subtitle"),
  editorForm: document.getElementById("editor-form"),
  editorTitleInput: document.getElementById("editor-title-input"),
  editorImageInput: document.getElementById("editor-image-input"),
  editorImageInlinePreview: document.getElementById("editor-image-inline-preview"),
  editorImageInlineImage: document.getElementById("editor-image-inline-image"),
  editorImageInlineFallback: document.getElementById("editor-image-inline-fallback"),
  editorTargetInput: document.getElementById("editor-target-input"),
  editorActiveInput: document.getElementById("editor-active-input"),
  editorPreviewMedia: document.getElementById("editor-preview-media"),
  editorPreviewImage: document.getElementById("editor-preview-image"),
  editorPreviewFallback: document.getElementById("editor-preview-fallback"),
  editorPreviewTitle: document.getElementById("editor-preview-title"),
  editorPreviewHost: document.getElementById("editor-preview-host"),
  editorPreviewStatus: document.getElementById("editor-preview-status"),
  editorCancel: document.getElementById("editor-cancel"),
  editorSubmit: document.getElementById("editor-submit"),

  deleteDialog: document.getElementById("delete-dialog"),
  deleteTarget: document.getElementById("delete-target"),
  deleteCancel: document.getElementById("delete-cancel"),
  deleteConfirm: document.getElementById("delete-confirm"),
};

boot();

function boot() {
  if (!requireAuthOrRedirect()) {
    return;
  }

  initLanguageSelect(elements.languageSelect);
  applyTranslations(document);
  hydrateSessionContext();
  syncControls();
  bindEvents();
  renderAll();
  void fetchAds();
}

function hydrateSessionContext() {
  elements.sessionUserBadge.textContent = getSessionUser();
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", logout);
  elements.searchInput.addEventListener("input", onSearchInput);

  elements.refreshButton.addEventListener("click", () => {
    void fetchAds();
  });

  elements.filterSelect.addEventListener("change", () => {
    state.activeFilter = elements.filterSelect.value;
    state.offset = 0;
    syncControls();
    void fetchAds();
  });

  elements.limitSelect.addEventListener("change", () => {
    state.limit = toPositiveInteger(elements.limitSelect.value, 10);
    state.offset = 0;
    syncControls();
    void fetchAds();
  });

  elements.prevButton.addEventListener("click", () => {
    state.offset = Math.max(0, state.offset - state.limit);
    syncControls();
    void fetchAds();
  });

  elements.nextButton.addEventListener("click", () => {
    if (state.offset + state.limit >= state.total) {
      return;
    }

    state.offset += state.limit;
    syncControls();
    void fetchAds();
  });

  elements.offsetApply.addEventListener("click", () => {
    state.offset = Math.max(0, toPositiveInteger(elements.offsetInput.value, 0));
    syncControls();
    void fetchAds();
  });

  elements.openCreateButton.addEventListener("click", openCreateDialog);
  elements.openCreateEmptyButton.addEventListener("click", openCreateDialog);

  elements.inspectorCopyLink.addEventListener("click", onCopySelectedLink);
  elements.inspectorEdit.addEventListener("click", () => {
    const ad = getSelectedAd();
    if (ad) {
      openEditDialog(ad);
    }
  });
  elements.inspectorDelete.addEventListener("click", () => {
    const ad = getSelectedAd();
    if (ad) {
      openDeleteDialog(ad);
    }
  });

  elements.editorForm.addEventListener("submit", onEditorSubmit);
  elements.editorCancel.addEventListener("click", () => {
    closeDialog(elements.editorDialog);
  });

  elements.editorTitleInput.addEventListener("input", syncEditorPreview);
  elements.editorImageInput.addEventListener("input", syncEditorPreview);
  elements.editorTargetInput.addEventListener("input", syncEditorPreview);
  elements.editorActiveInput.addEventListener("change", syncEditorPreview);

  elements.deleteCancel.addEventListener("click", () => {
    closeDialog(elements.deleteDialog);
  });
  elements.deleteConfirm.addEventListener("click", onDeleteConfirm);

  bindDialogBackdrop(elements.editorDialog, () => closeDialog(elements.editorDialog));
  bindDialogBackdrop(elements.deleteDialog, () => closeDialog(elements.deleteDialog));

  elements.editorDialog.addEventListener("close", resetEditorState);
  elements.deleteDialog.addEventListener("close", resetDeleteState);

  document.addEventListener("languagechange", () => {
    hydrateSessionContext();
    syncControls();
    syncEditorDialogCopy();
    renderAll();
  });
}

function bindDialogBackdrop(dialog, onClose) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      onClose();
    }
  });
}

function onSearchInput(event) {
  state.searchTerm = String(event.target.value || "").trim().toLowerCase();
  syncVisibleAds();
  renderAll();
}

function syncControls() {
  elements.filterSelect.value = state.activeFilter;
  elements.limitSelect.value = String(state.limit);
  elements.offsetInput.value = String(state.offset);
  elements.searchInput.value = state.searchTerm;
}

function activeFilterToParam(value) {
  if (value === "active") {
    return true;
  }

  if (value === "inactive") {
    return false;
  }

  return undefined;
}

async function fetchAds() {
  const requestID = ++state.fetchSequence;
  setLoading(true);

  try {
    const response = await listAds({
      limit: state.limit,
      offset: state.offset,
      active: activeFilterToParam(state.activeFilter),
    });

    if (requestID !== state.fetchSequence) {
      return;
    }

    state.ads = normalizeAdsResponse(response);
    state.total = normalizeTotalResponse(response, state.ads.length);
    syncVisibleAds();
  } catch (error) {
    if (requestID !== state.fetchSequence) {
      return;
    }

    handleAPIError(error);
  } finally {
    if (requestID === state.fetchSequence) {
      setLoading(false);
      renderAll();
    }
  }
}

function setLoading(pending) {
  state.isLoading = pending;
  elements.tablePanel.classList.toggle("is-busy", pending);
  setButtonPending(elements.refreshButton, pending, `${t("refresh")}...`);
  updatePagination();
  renderTable();
}

function normalizeAdsResponse(payload) {
  const raw = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

  return raw.map(normalizeAd).filter((ad) => ad.id);
}

function normalizeTotalResponse(payload, fallback) {
  const candidate = Number(payload?.total ?? payload?.count ?? payload?.meta?.total);
  if (Number.isFinite(candidate) && candidate >= 0) {
    return candidate;
  }

  return fallback;
}

function normalizeAd(raw) {
  return {
    id: String(raw?.id ?? raw?.ID ?? raw?._id ?? ""),
    title: String(raw?.title ?? raw?.name ?? "").trim(),
    image_url: String(raw?.image_url ?? raw?.imageUrl ?? "").trim(),
    target_url: String(raw?.target_url ?? raw?.targetUrl ?? "").trim(),
    is_active: toBoolean(raw?.is_active ?? raw?.isActive),
    created_at: String(raw?.created_at ?? raw?.createdAt ?? ""),
    updated_at: String(raw?.updated_at ?? raw?.updatedAt ?? ""),
  };
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true" || value === "1";
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return false;
}

function syncVisibleAds() {
  const query = state.searchTerm;
  state.visibleAds = query ? state.ads.filter((ad) => matchesSearch(ad, query)) : [...state.ads];
  ensureSelection();
}

function matchesSearch(ad, query) {
  const haystack = [
    ad.title,
    ad.id,
    ad.target_url,
    ad.image_url,
    hostnameFromURL(ad.target_url),
    hostnameFromURL(ad.image_url),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function ensureSelection() {
  if (state.visibleAds.some((ad) => ad.id === state.selectedAdID)) {
    return;
  }

  state.selectedAdID = state.visibleAds[0]?.id || "";
}

function renderAll() {
  renderStats();
  renderSummary();
  renderTable();
  updatePagination();
  renderInspector();
  syncEditorDialogCopy();
  syncEditorPreview();
}

function renderStats() {
  const language = getLanguage();
  const activeCount = state.ads.filter((ad) => ad.is_active).length;
  const inactiveCount = state.ads.length - activeCount;

  elements.statTotal.textContent = formatNumber(state.total, language);
  elements.statLoaded.textContent = formatNumber(state.ads.length, language);
  elements.statActive.textContent = formatNumber(activeCount, language);
  elements.statInactive.textContent = formatNumber(inactiveCount, language);
}

function renderSummary() {
  const language = getLanguage();
  elements.tablePanelSummary.textContent = t("table_summary", {
    visible: formatNumber(state.visibleAds.length, language),
    loaded: formatNumber(state.ads.length, language),
    total: formatNumber(state.total, language),
  });
}

function renderTable() {
  clearChildren(elements.tableBody);
  elements.tableEmpty.hidden = true;

  if (state.isLoading && state.ads.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = t("loading_ads");
    row.appendChild(cell);
    elements.tableBody.appendChild(row);
    return;
  }

  if (state.visibleAds.length === 0) {
    elements.tableEmpty.hidden = state.isLoading;
    return;
  }

  state.visibleAds.forEach((ad, index) => {
    elements.tableBody.appendChild(renderRow(ad, index));
  });
}

function renderRow(ad, index) {
  const language = getLanguage();
  const row = document.createElement("tr");

  if (ad.id === state.selectedAdID) {
    row.classList.add("is-selected");
  }

  row.tabIndex = 0;
  row.addEventListener("click", () => {
    selectAd(ad.id);
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectAd(ad.id);
    }
  });

  const indexCell = document.createElement("td");
  indexCell.className = "row-index";
  indexCell.textContent = formatNumber(state.offset + index + 1, language);

  const campaignCell = document.createElement("td");
  campaignCell.appendChild(buildCampaignCell(ad));

  const destinationCell = document.createElement("td");
  destinationCell.appendChild(buildDestinationCell(ad));

  const statusCell = document.createElement("td");
  const statusButton = document.createElement("button");
  statusButton.type = "button";
  statusButton.className = "status-chip";
  applyStatusChip(statusButton, ad.is_active);
  statusButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void onToggleStatus(ad, statusButton);
  });
  statusCell.appendChild(statusButton);

  const createdCell = document.createElement("td");
  createdCell.textContent = formatDateTime(ad.created_at, language);

  const updatedCell = document.createElement("td");
  updatedCell.textContent = formatDateTime(ad.updated_at, language);

  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "table-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "table-action";
  editButton.textContent = t("action_edit");
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openEditDialog(ad);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "table-action danger";
  deleteButton.textContent = t("action_delete");
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDialog(ad);
  });

  actions.append(editButton, deleteButton);
  actionsCell.appendChild(actions);

  row.append(indexCell, campaignCell, destinationCell, statusCell, createdCell, updatedCell, actionsCell);
  return row;
}

function buildCampaignCell(ad) {
  const wrap = document.createElement("div");
  wrap.className = "campaign-cell";

  wrap.appendChild(createMediaThumb(ad.title, ad.image_url));

  const copy = document.createElement("div");
  copy.className = "table-stack";

  const title = document.createElement("div");
  title.className = "primary-text";
  title.textContent = ad.title || "-";

  copy.appendChild(title);
  wrap.appendChild(copy);

  return wrap;
}

function buildDestinationCell(ad) {
  const host = hostnameFromURL(ad.target_url);
  if (!host || !isValidHttpURL(ad.target_url)) {
    const empty = document.createElement("span");
    empty.className = "destination-empty";
    empty.textContent = "-";
    return empty;
  }

  const link = document.createElement("a");
  link.className = "destination-link";
  link.href = ad.target_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = ad.target_url;
  link.textContent = host;
  link.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  return link;
}

function createMediaThumb(title, imageURL) {
  const wrapper = document.createElement("div");
  wrapper.className = "media-thumb";

  const fallback = document.createElement("div");
  fallback.className = "media-fallback";
  fallback.textContent = initialsFromTitle(title);
  wrapper.appendChild(fallback);

  if (isValidHttpURL(imageURL)) {
    const image = document.createElement("img");
    image.alt = title || "Ad image";
    image.loading = "lazy";
    image.hidden = true;
    image.onload = () => {
      wrapper.classList.add("has-image");
      image.hidden = false;
    };
    image.src = imageURL;
    image.addEventListener("error", () => {
      wrapper.classList.remove("has-image");
      image.remove();
    });
    wrapper.appendChild(image);
  }

  return wrapper;
}

function applyStatusChip(element, isActive) {
  element.classList.toggle("is-active", isActive);
  element.classList.toggle("is-inactive", !isActive);
  element.textContent = isActive ? t("status_active") : t("status_inactive");
}

function updatePagination() {
  const language = getLanguage();
  const start = state.total === 0 ? 0 : state.offset + 1;
  const end = state.total === 0 ? 0 : state.offset + state.ads.length;

  elements.paginationInfo.textContent = t("pagination_info", {
    start: formatNumber(start, language),
    end: formatNumber(end, language),
    total: formatNumber(state.total, language),
  });

  elements.prevButton.disabled = state.isLoading || state.offset <= 0;
  elements.nextButton.disabled = state.isLoading || state.offset + state.limit >= state.total;
  elements.offsetApply.disabled = state.isLoading;
}

function selectAd(adID) {
  state.selectedAdID = adID;
  renderTable();
  renderInspector();
}

function getSelectedAd() {
  return state.ads.find((ad) => ad.id === state.selectedAdID) || null;
}

function renderInspector() {
  const ad = getSelectedAd();
  const language = getLanguage();

  if (!ad) {
    elements.inspectorEmpty.hidden = false;
    elements.inspectorCard.hidden = true;
    return;
  }

  elements.inspectorEmpty.hidden = true;
  elements.inspectorCard.hidden = false;

  setMediaPreview(elements.inspectorMedia, elements.inspectorImage, elements.inspectorFallback, ad.title, ad.image_url);
  elements.inspectorTitle.textContent = ad.title || "-";
  elements.inspectorID.textContent = t("inspector_id", { id: ad.id });
  applyStatusChip(elements.inspectorStatus, ad.is_active);
  elements.inspectorStatusText.textContent = ad.is_active ? t("status_active") : t("status_inactive");
  elements.inspectorCreated.textContent = formatDateTime(ad.created_at, language);
  elements.inspectorUpdated.textContent = formatDateTime(ad.updated_at, language);

  setLink(elements.inspectorTarget, ad.target_url);
  setLink(elements.inspectorImageLink, ad.image_url);

  elements.inspectorCopyLink.disabled = !ad.target_url;
}

function setLink(link, value) {
  if (!isValidHttpURL(value)) {
    link.textContent = "-";
    link.removeAttribute("href");
    link.removeAttribute("title");
    return;
  }

  link.href = value;
  link.title = value;
  link.textContent = hostnameFromURL(value) || value;
}

async function onCopySelectedLink() {
  const ad = getSelectedAd();
  if (!ad?.target_url) {
    return;
  }

  try {
    await copyText(ad.target_url);
    showToast("success", t("toast_copied"));
  } catch {
    showToast("error", t("toast_copy_failed"));
  }
}

function openCreateDialog() {
  state.editorMode = "create";
  state.editingAd = null;
  elements.editorForm.reset();
  elements.editorActiveInput.checked = true;
  syncEditorDialogCopy();
  syncEditorPreview();
  openDialog(elements.editorDialog);
  elements.editorTitleInput.focus();
}

function openEditDialog(ad) {
  state.editorMode = "edit";
  state.editingAd = ad;
  elements.editorTitleInput.value = ad.title || "";
  elements.editorImageInput.value = ad.image_url || "";
  elements.editorTargetInput.value = ad.target_url || "";
  elements.editorActiveInput.checked = Boolean(ad.is_active);
  syncEditorDialogCopy();
  syncEditorPreview();
  openDialog(elements.editorDialog);
  elements.editorTitleInput.focus();
}

function syncEditorDialogCopy() {
  const createMode = state.editorMode === "create";
  elements.editorTitle.textContent = createMode ? t("editor_create_title") : t("editor_edit_title");
  elements.editorSubtitle.textContent = createMode ? t("editor_create_subtitle") : t("editor_edit_subtitle");
  elements.editorSubmit.textContent = createMode ? t("create_button") : t("save_changes");
}

function syncEditorPreview() {
  const title = elements.editorTitleInput.value.trim();
  const imageURL = elements.editorImageInput.value.trim();
  const targetURL = elements.editorTargetInput.value.trim();

  setMediaPreview(
    elements.editorImageInlinePreview,
    elements.editorImageInlineImage,
    elements.editorImageInlineFallback,
    title,
    imageURL,
  );
  setMediaPreview(elements.editorPreviewMedia, elements.editorPreviewImage, elements.editorPreviewFallback, title, imageURL);
  elements.editorPreviewTitle.textContent = title || t("field_title_placeholder");
  elements.editorPreviewHost.textContent = hostnameFromURL(targetURL) || t("field_target_url");
  applyStatusChip(elements.editorPreviewStatus, elements.editorActiveInput.checked);
}

async function onEditorSubmit(event) {
  event.preventDefault();

  const payload = readEditorPayload();
  const validationError = validatePayload(payload);
  if (validationError) {
    showToast("error", validationError);
    return;
  }

  try {
    setButtonPending(elements.editorSubmit, true, `${elements.editorSubmit.textContent}...`);

    if (state.editorMode === "create") {
      await createAd(payload);
      showToast("success", t("toast_created"));
      state.offset = 0;
    } else if (state.editingAd) {
      const patch = buildPatch(state.editingAd, payload);
      if (Object.keys(patch).length === 0) {
        showToast("info", t("toast_no_changes"));
        return;
      }

      await updateAd(state.editingAd.id, patch);
      showToast("success", t("toast_saved"));
    }

    syncControls();
    closeDialog(elements.editorDialog);
    await fetchAds();
  } catch (error) {
    handleAPIError(error);
  } finally {
    setButtonPending(elements.editorSubmit, false);
  }
}

function readEditorPayload() {
  return {
    title: elements.editorTitleInput.value.trim(),
    image_url: elements.editorImageInput.value.trim(),
    target_url: elements.editorTargetInput.value.trim(),
    is_active: elements.editorActiveInput.checked,
  };
}

function validatePayload(payload) {
  if (!payload.title) {
    return t("validation_required", { field: t("field_title") });
  }

  if (!payload.image_url) {
    return t("validation_required", { field: t("field_image_url") });
  }

  if (!isValidHttpURL(payload.image_url)) {
    return t("validation_url", { field: t("field_image_url") });
  }

  if (!payload.target_url) {
    return t("validation_required", { field: t("field_target_url") });
  }

  if (!isValidHttpURL(payload.target_url)) {
    return t("validation_url", { field: t("field_target_url") });
  }

  return "";
}

function buildPatch(original, next) {
  const patch = {};

  if (next.title !== original.title) {
    patch.title = next.title;
  }

  if (next.image_url !== original.image_url) {
    patch.image_url = next.image_url;
  }

  if (next.target_url !== original.target_url) {
    patch.target_url = next.target_url;
  }

  if (next.is_active !== original.is_active) {
    patch.is_active = next.is_active;
  }

  return patch;
}

function resetEditorState() {
  state.editorMode = "create";
  state.editingAd = null;
  elements.editorForm.reset();
  elements.editorActiveInput.checked = true;
  syncEditorDialogCopy();
  syncEditorPreview();
}

function openDeleteDialog(ad) {
  state.deletingAd = ad;
  elements.deleteTarget.textContent = ad.title || ad.id || "-";
  openDialog(elements.deleteDialog);
}

async function onDeleteConfirm() {
  if (!state.deletingAd) {
    return;
  }

  try {
    setButtonPending(elements.deleteConfirm, true, `${t("delete_confirm")}...`);
    await deleteAd(state.deletingAd.id);
    showToast("success", t("toast_deleted"));

    if (state.selectedAdID === state.deletingAd.id) {
      state.selectedAdID = "";
    }

    closeDialog(elements.deleteDialog);
    await fetchAds();
  } catch (error) {
    handleAPIError(error);
  } finally {
    setButtonPending(elements.deleteConfirm, false);
  }
}

function resetDeleteState() {
  state.deletingAd = null;
  elements.deleteTarget.textContent = "";
}

async function onToggleStatus(ad, button) {
  try {
    button.disabled = true;
    await updateAd(ad.id, { is_active: !ad.is_active });
    showToast("success", t("toast_toggled"));
    await fetchAds();
  } catch (error) {
    handleAPIError(error);
  } finally {
    button.disabled = false;
  }
}

function handleAPIError(error) {
  if (error?.status === 401) {
    redirectToLogin();
    return;
  }

  showToast("error", mapErrorMessage(error, t));
}

function setMediaPreview(container, image, fallback, title, url) {
  fallback.textContent = initialsFromTitle(title);
  container.classList.remove("has-image");
  image.onload = null;
  image.onerror = null;
  image.hidden = true;
  image.removeAttribute("src");

  if (!isValidHttpURL(url)) {
    return;
  }

  const imageURL = url;
  image.alt = title || "Ad image";
  image.dataset.src = imageURL;

  image.onload = () => {
    if (image.dataset.src !== imageURL) {
      return;
    }

    container.classList.add("has-image");
    image.hidden = false;
  };

  image.onerror = () => {
    if (image.dataset.src !== imageURL) {
      return;
    }

    container.classList.remove("has-image");
    image.hidden = true;
    image.removeAttribute("src");
  };

  image.src = imageURL;
}

function initialsFromTitle(title) {
  const source = String(title || "").trim();
  if (!source) {
    return "TL";
  }

  const parts = source.split(/\s+/).slice(0, 2);
  const value = parts.map((part) => part[0]).join("").toUpperCase();
  return value || source.slice(0, 2).toUpperCase();
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}
