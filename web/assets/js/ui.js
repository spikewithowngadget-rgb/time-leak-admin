export function setButtonPending(button, pending, pendingText) {
  if (!button) {
    return;
  }

  if (pending) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || "";
    }

    if (pendingText) {
      button.textContent = pendingText;
    }

    button.disabled = true;
    return;
  }

  button.disabled = false;
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

export function showToast(type, message) {
  const container = document.getElementById("toast-container");
  if (!container || !message) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const text = document.createElement("span");
  text.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.textContent = "x";

  const remove = () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  };

  closeButton.addEventListener("click", remove);

  toast.append(text, closeButton);
  container.appendChild(toast);

  window.setTimeout(remove, 4200);
}

export function clearChildren(element) {
  while (element && element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function formatDateTime(value, language) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const localeMap = {
    kz: "kk-KZ",
    ru: "ru-RU",
    en: "en-US",
  };

  return new Intl.DateTimeFormat(localeMap[language] || "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value, language) {
  const localeMap = {
    kz: "kk-KZ",
    ru: "ru-RU",
    en: "en-US",
  };

  return new Intl.NumberFormat(localeMap[language] || "en-US").format(Number(value) || 0);
}

export function isValidHttpURL(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostnameFromURL(value) {
  if (!isValidHttpURL(value)) {
    return "";
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function copyText(value) {
  if (!value) {
    throw new Error("empty_value");
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function mapErrorMessage(error, t) {
  if (!error) {
    return t("api_unknown");
  }

  switch (error.status) {
    case 400:
      return appendServerError(t("api_400"), error.apiError);
    case 401:
      return appendServerError(t("api_401"), error.apiError);
    case 403:
      return appendServerError(t("api_403"), error.apiError);
    case 404:
      return appendServerError(t("api_404"), error.apiError);
    case 500:
      return appendServerError(t("api_500"), error.apiError);
    case 0:
      return t("api_network");
    default:
      return appendServerError(t("api_unknown"), error.apiError || error.message);
  }
}

function appendServerError(base, serverError) {
  if (!serverError) {
    return base;
  }

  return `${base}: ${serverError}`;
}

export function openDialog(dialog) {
  if (!dialog) {
    return;
  }

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "true");
}

export function closeDialog(dialog) {
  if (!dialog) {
    return;
  }

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
}
