import { getReminderSettings, updateReminderSettings, getReminderStatus } from "./api.js";
import { redirectToLogin } from "./auth.js";
import { getLanguage, t } from "./i18n.js";
import { el, mapErrorMessage, showToast, formatDateTime } from "./ui.js";

let nodes = {};
let status = null;
let loaded = false;
let pending = false;
let loadID = 0;
const presets = [1, 3, 7, 14, 30];

export function mountReminderSettings(root) {
  const node = id => root.querySelector(`#${id}`);
  nodes = {
    form: node("reminder-settings-form"), fields: node("reminder-settings-fields"),
    enabled: node("reminder-enabled"), preset: node("reminder-days-preset"), days: node("reminder-custom-days"),
    custom: node("reminder-custom-days-field"), hour: node("reminder-send-hour"), timezone: node("reminder-timezone"),
    feedback: node("reminder-feedback"), summary: node("reminder-schedule-summary"),
    refresh: node("reminder-refresh"), save: node("reminder-save"), sender: node("reminder-sender-status"),
    counts: node("reminder-status-counts"), last: node("reminder-last-sent"),
  };
  for (let hour = 0; hour < 24; hour++) nodes.hour.appendChild(el("option", { value: hour, text: `${String(hour).padStart(2, "0")}:00` }));
  nodes.hour.value = "9";
  nodes.preset.addEventListener("change", () => {
    nodes.custom.hidden = nodes.preset.value !== "custom";
    renderSummary();
  });
  [nodes.days, nodes.hour, nodes.timezone, nodes.enabled].forEach(node => node.addEventListener("input", renderSummary));
  nodes.refresh.addEventListener("click", () => void load());
  nodes.form.addEventListener("submit", save);
  document.addEventListener("languagechange", () => { renderSummary(); renderStatus(); });
  renderSummary();
}

export function activateReminderSettings() { void load(); }

function values() {
  return {
    enabled: nodes.enabled.checked,
    days_before: Number(nodes.preset.value === "custom" ? nodes.days.value : nodes.preset.value),
    send_hour: Number(nodes.hour.value), timezone: nodes.timezone.value.trim(),
  };
}

function renderSummary() {
  if (!nodes.summary) return;
  const value = values();
  const key = !value.enabled ? "set_rem_paused" : value.days_before === 3 ? "set_rem_schedule_default" : value.days_before === 1 ? "set_rem_schedule_one" : "set_rem_schedule";
  nodes.summary.textContent = t(key, {days: value.days_before || "?", time: `${String(value.send_hour).padStart(2, "0")}:00`, timezone: value.timezone || "?"});
  nodes.save.textContent = t(pending ? "set_rem_saving" : "common_save");
}

function renderStatus() {
  nodes.counts.replaceChildren();
  if (!status) { nodes.sender.textContent = ""; nodes.last.textContent = ""; return; }
  nodes.sender.textContent = t(status.sender_configured ? "set_rem_sender_ready" : "set_rem_sender_missing");
  nodes.sender.dataset.error = String(!status.sender_configured);
  for (const key of ["verified_contacts", "pending", "sent", "failed", "cancelled"]) {
    const count = Math.max(0, Number(status[key]) || 0);
    nodes.counts.appendChild(el("div", {}, [el("dt", {text: t(`set_rem_${key}`)}), el("dd", {text: new Intl.NumberFormat(getLanguage() === "kz" ? "kk" : getLanguage()).format(count)})]));
  }
  const times = [["last_run_at", "set_rem_last_run"], ["next_run_at", "set_rem_next_run"], ["last_sent_at", "set_rem_last_sent"]];
  nodes.last.replaceChildren(...times.map(([key, label]) => el("span", {class: "reminder-status-time", text: `${t(label)}: ${status[key] ? formatDateTime(status[key], getLanguage()) : t("set_rem_no_runs")}`})));
}

function fill(settings) {
  nodes.enabled.checked = Boolean(settings.enabled);
  nodes.preset.value = presets.includes(settings.days_before) ? String(settings.days_before) : "custom";
  nodes.days.value = String(settings.days_before);
  nodes.custom.hidden = nodes.preset.value !== "custom";
  nodes.hour.value = String(settings.send_hour);
  nodes.timezone.value = settings.timezone;
  renderSummary();
}

function failure(error) {
  if (error?.status === 401) { redirectToLogin(); return; }
  nodes.feedback.textContent = mapErrorMessage(error, t);
  nodes.feedback.dataset.error = "true";
}

async function load() {
  if (pending) return;
  const request = ++loadID;
  nodes.refresh.disabled = true;
  nodes.feedback.textContent = t("set_rem_loading");
  nodes.feedback.dataset.error = "false";
  try {
    const [settings, deliveryStatus] = await Promise.all([getReminderSettings(), getReminderStatus()]);
    if (request !== loadID) return;
    fill(settings);
    status = deliveryStatus;
    loaded = true;
    nodes.fields.disabled = false;
    nodes.feedback.textContent = "";
    renderStatus();
  } catch (error) { if (request === loadID) failure(error); }
  finally { if (request === loadID) nodes.refresh.disabled = false; }
}

async function save(event) {
  event.preventDefault();
  if (pending || !loaded) return;
  const value = values();
  if (!Number.isInteger(value.days_before) || value.days_before < 1 || value.days_before > 30 || !Number.isInteger(value.send_hour) || value.send_hour < 0 || value.send_hour > 23) {
    nodes.feedback.textContent = t("set_rem_invalid"); nodes.feedback.dataset.error = "true"; return;
  }
  try {
    if (!value.timezone || value.timezone === "Local") throw new Error();
    new Intl.DateTimeFormat("en", {timeZone: value.timezone}).format();
  } catch { nodes.feedback.textContent = t("set_rem_invalid_timezone"); nodes.feedback.dataset.error = "true"; return; }
  pending = true;
  loadID++;
  nodes.fields.disabled = true;
  nodes.refresh.disabled = true;
  renderSummary();
  try {
    fill(await updateReminderSettings(value));
    nodes.feedback.textContent = t("toast_saved");
    nodes.feedback.dataset.error = "false";
    showToast("success", t("toast_saved"));
    // Refresh aggregate state only: saving settings never sends an email.
    try { status = await getReminderStatus(); renderStatus(); }
    catch { nodes.feedback.textContent = t("set_rem_status_unavailable"); }
  } catch (error) { failure(error); }
  finally { pending = false; nodes.fields.disabled = false; nodes.refresh.disabled = false; renderSummary(); }
}
