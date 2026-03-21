import { getRuntimeConfig } from "./config.js";
import { expireSession, getRefreshToken, getSessionUser, getToken, isSessionExpired, saveSession } from "./auth.js";

export class APIError extends Error {
  constructor(message, status, apiError, body) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.apiError = apiError;
    this.body = body;
  }
}

function buildURL(path) {
  const config = getRuntimeConfig();
  const base = String(config.API_BASE_URL || "https://api.timeleak.kz").replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function parseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText);
    } catch {
      return { error: rawText };
    }
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function resolveStatusMessage(status) {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 500:
      return "internal_server_error";
    default:
      return "request_failed";
  }
}

let refreshPromise = null;

function buildAPIError(response, payload) {
  const apiError = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "";
  return new APIError(resolveStatusMessage(response.status), response.status, apiError, payload);
}

function buildRequestInit(method, headers, body, signal) {
  return {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  };
}

async function fetchJSON(url, init) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : "network_error", 0, "network_error", null);
  }

  const payload = await parseBody(response);
  return { response, payload };
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    const headers = new Headers({
      Accept: "application/json, text/plain;q=0.9",
      "Content-Type": "application/json",
    });

    refreshPromise = (async () => {
      const { response, payload } = await fetchJSON(
        buildURL("/api/v1/auth/refresh"),
        buildRequestInit("POST", headers, { refresh_token: refreshToken }, undefined),
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          expireSession();
        }

        throw buildAPIError(response, payload);
      }

      if (!payload?.access_token || !payload?.expires_in_seconds) {
        expireSession();
        throw new APIError("invalid_refresh_response", 401, "invalid_refresh_response", payload);
      }

      saveSession(payload.access_token, payload.expires_in_seconds, getSessionUser(), payload.refresh_token || refreshToken);
      return payload.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function resolveRequestToken() {
  const token = getToken();
  if (!token) {
    return refreshAccessToken();
  }

  if (!isSessionExpired()) {
    return token;
  }

  if (getRefreshToken()) {
    return refreshAccessToken();
  }

  return token;
}

async function request(path, options = {}) {
  const { authRequired = true, body, headers = {}, method = "GET", signal } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  requestHeaders.set("Accept", "application/json, text/plain;q=0.9");

  if (authRequired) {
    const token = await resolveRequestToken();
    if (!token) {
      expireSession();
      throw new APIError("unauthorized", 401, "unauthorized", { error: "unauthorized" });
    }

    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const url = buildURL(path);
  let retriedAfterRefresh = false;
  let { response, payload } = await fetchJSON(url, buildRequestInit(method, requestHeaders, body, signal));

  if (!response.ok && authRequired && response.status === 401 && getRefreshToken() && path !== "/api/v1/auth/refresh") {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      requestHeaders.set("Authorization", `Bearer ${refreshedToken}`);
      retriedAfterRefresh = true;
      ({ response, payload } = await fetchJSON(url, buildRequestInit(method, requestHeaders, body, signal)));
    }
  }

  if (!response.ok) {
    if (authRequired && response.status === 401 && (retriedAfterRefresh || !getRefreshToken())) {
      expireSession();
    }

    throw buildAPIError(response, payload);
  }

  return payload;
}

export function login(username, password) {
  return request("/api/v1/admin/auth/login", {
    method: "POST",
    authRequired: false,
    body: { username, password },
  });
}

export function listAds({ limit, offset, active, signal }) {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("offset", String(offset));

  if (typeof active === "boolean") {
    query.set("active", String(active));
  }

  return request(`/api/v1/admin/ads?${query.toString()}`, { signal });
}

export function createAd(data) {
  return request("/api/v1/admin/ads", {
    method: "POST",
    body: data,
  });
}

export function updateAd(id, patch) {
  return request(`/api/v1/admin/ads/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: patch,
  });
}

export function deleteAd(id) {
  return request(`/api/v1/admin/ads/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getLatestOtp(phone) {
  const query = new URLSearchParams({ phone });
  return request(`/api/v1/admin/testing/otp/latest?${query.toString()}`, {
    authRequired: false,
    headers: {
      Accept: "text/plain, application/json;q=0.9",
    },
  });
}
