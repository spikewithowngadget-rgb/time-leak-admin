const TOKEN_KEY = "timeleak_admin_token";
const REFRESH_TOKEN_KEY = "timeleak_admin_refresh_token";
const EXPIRES_AT_KEY = "timeleak_admin_expires_at";
const USERNAME_KEY = "timeleak_admin_username";
const LOGIN_NOTICE_KEY = "timeleak_admin_login_notice";

export function saveSession(accessToken, expiresInSeconds, username = "Admin", refreshToken = "") {
  const expiresAt = Date.now() + Number(expiresInSeconds || 0) * 1000;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function expireSession(reason = "toast_session_expired") {
  clearSession();
  sessionStorage.setItem(LOGIN_NOTICE_KEY, reason);
}

export function consumeLoginNotice() {
  const value = sessionStorage.getItem(LOGIN_NOTICE_KEY);
  if (!value) {
    return "";
  }

  sessionStorage.removeItem(LOGIN_NOTICE_KEY);
  return value;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getSessionUser() {
  return localStorage.getItem(USERNAME_KEY) || "Admin";
}

export function isSessionExpired() {
  const raw = localStorage.getItem(EXPIRES_AT_KEY);
  if (!raw) {
    return true;
  }

  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return Date.now() >= expiresAt;
}

export function hasActiveSession() {
  return Boolean((getToken() && !isSessionExpired()) || getRefreshToken());
}

export function hasResumableSession() {
  return Boolean(getToken() || getRefreshToken());
}

export function requireAuthOrRedirect() {
  if (!hasResumableSession()) {
    redirectToLogin();
    return false;
  }

  return true;
}

export function redirectToLogin() {
  window.location.assign("/login");
}

export function redirectToDashboard() {
  window.location.assign("/dashboard");
}

export function logout() {
  clearSession();
  redirectToLogin();
}
