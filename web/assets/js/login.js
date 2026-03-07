import { login } from "./api.js";
import { consumeLoginNotice, hasActiveSession, redirectToDashboard, saveSession } from "./auth.js";
import { applyTranslations, initLanguageSelect, t } from "./i18n.js";
import { mapErrorMessage, setButtonPending, showToast } from "./ui.js";

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("login-submit");
const languageSelect = document.getElementById("language-select");

boot();

function boot() {
  initLanguageSelect(languageSelect);
  applyTranslations(document);

  const loginNotice = consumeLoginNotice();
  if (loginNotice) {
    showToast("info", t(loginNotice));
  }

  if (hasActiveSession()) {
    redirectToDashboard();
    return;
  }

  form.addEventListener("submit", onSubmit);
}

async function onSubmit(event) {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username) {
    showToast("error", t("validation_required", { field: t("username_label") }));
    usernameInput.focus();
    return;
  }

  if (!password) {
    showToast("error", t("validation_required", { field: t("password_label") }));
    passwordInput.focus();
    return;
  }

  try {
    setButtonPending(submitButton, true, `${t("login_button")}...`);
    const response = await login(username, password);

    if (!response || !response.access_token || !response.expires_in_seconds) {
      throw new Error("invalid_login_response");
    }

    saveSession(response.access_token, response.expires_in_seconds, username, response.refresh_token || "");
    showToast("success", t("toast_login_success"));

    window.setTimeout(() => {
      redirectToDashboard();
    }, 200);
  } catch (error) {
    showToast("error", mapErrorMessage(error, t));
  } finally {
    setButtonPending(submitButton, false);
  }
}
