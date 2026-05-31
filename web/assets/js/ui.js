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

// el is a small helper to build a DOM node with attributes and children.
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const { class: className, text, html, dataset, ...attrs } = options;
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  if (html !== undefined) {
    node.innerHTML = html;
  }
  if (dataset) {
    Object.entries(dataset).forEach(([key, value]) => {
      node.dataset[key] = value;
    });
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) {
      return;
    }
    node.setAttribute(key, value === true ? "" : String(value));
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined) {
      return;
    }
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

export function formatRelativeTime(value, language) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const localeMap = { kz: "kk-KZ", ru: "ru-RU", en: "en-US" };
  const locale = localeMap[language] || "en-US";
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, seconds] of units) {
      if (absSec >= seconds || unit === "second") {
        return rtf.format(Math.round(diffMs / 1000 / seconds), unit);
      }
    }
  } catch {
    /* fall back below */
  }
  return formatDateTime(value, language);
}

export function formatCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "-";
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export function emptyState(title, copy) {
  return el("div", { class: "empty-state" }, [
    el("h3", { class: "empty-title", text: title }),
    el("p", { class: "empty-copy", text: copy }),
  ]);
}

export function errorState(title, copy, retryLabel, onRetry) {
  const retry = el("button", { class: "btn btn-secondary", type: "button", text: retryLabel });
  retry.addEventListener("click", onRetry);
  return el("div", { class: "empty-state error-state" }, [
    el("h3", { class: "empty-title", text: title }),
    el("p", { class: "empty-copy", text: copy }),
    retry,
  ]);
}

export function loadingState(text) {
  return el("div", { class: "loading-state" }, [
    el("span", { class: "spinner", "aria-hidden": "true" }),
    el("span", { text }),
  ]);
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
