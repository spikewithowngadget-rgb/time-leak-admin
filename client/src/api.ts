import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosRequestConfig,
} from "axios";
import type {
  Ad,
  EmailOtpRequest,
  EmailReminderContact,
  Note,
  NoteShare,
  NotesByDateResponse,
  NotesMetaResponse,
  NoteMeta,
  OtpRequest,
  OtpVerification,
  SharedNote,
  TokenPair,
  UserProfile,
} from "./types";

export const API_URL = (
  import.meta.env.VITE_API_URL || "https://api.timeleak.kz"
).replace(/\/$/, "");
const ACCESS_KEY = "tl_access_token";
const REFRESH_KEY = "tl_refresh_token";
export const AUTH_EVENT = "tl-auth-change";
let refreshFlight: Promise<TokenPair> | null = null;
let didLogout = false;
let sessionVersion = 0;
export const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});
const publicApi = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const hasSession = () =>
  Boolean(getAccessToken() || localStorage.getItem(REFRESH_KEY));
export function getSessionIdentity(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const data = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof data.uid === "string"
      ? data.uid
      : typeof data.sub === "string"
        ? data.sub
        : null;
  } catch {
    return null;
  }
}
export function saveSession(pair: TokenPair) {
  if (!pair.access_token || !pair.refresh_token)
    throw new Error("Invalid authentication response");
  localStorage.setItem(ACCESS_KEY, pair.access_token);
  localStorage.setItem(REFRESH_KEY, pair.refresh_token);
  sessionVersion++;
  didLogout = false;
  window.dispatchEvent(new Event(AUTH_EVENT));
}
export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionVersion++;
  if (!didLogout) {
    didLogout = true;
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}
export function errorMessage(
  error: unknown,
  fallback = "Не удалось выполнить запрос. Попробуйте ещё раз.",
) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      for (const key of ["error", "message", "detail"]) {
        if (typeof data[key] === "string" && data[key]) return data[key];
      }
    }
    if (!error.response)
      return "Не удалось подключиться. Проверьте интернет и попробуйте ещё раз.";
  }
  if (error instanceof Error && !axios.isAxiosError(error))
    return error.message;
  return fallback;
}
function shouldRefresh(token: string) {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (
      typeof payload.exp === "number" &&
      payload.exp * 1000 <= Date.now() + 20_000
    );
  } catch {
    return false;
  }
}
export function refreshSession(): Promise<TokenPair> {
  if (refreshFlight) return refreshFlight;
  const requestedRefresh = localStorage.getItem(REFRESH_KEY);
  const performRefresh = async (): Promise<TokenPair> => {
    const token = localStorage.getItem(REFRESH_KEY);
    const access = getAccessToken();
    // A different tab may have completed rotation while this tab waited for
    // the browser-wide lock. Read the shared tokens after acquiring the lock.
    if (
      token &&
      token !== requestedRefresh &&
      access &&
      !shouldRefresh(access)
    ) {
      return { access_token: access, refresh_token: token };
    }
    const version = sessionVersion;
    if (!token) {
      clearSession();
      throw new Error("Сессия завершена. Войдите ещё раз.");
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data } = await publicApi.post<TokenPair>(
          "/api/v1/auth/refresh",
          { refresh_token: token },
        );
        if (
          version !== sessionVersion ||
          localStorage.getItem(REFRESH_KEY) !== token
        )
          throw new Error("Сессия изменилась. Повторите действие.");
        saveSession(data);
        return data;
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        if (status === 401 || status === 403) {
          if (
            version === sessionVersion &&
            localStorage.getItem(REFRESH_KEY) === token
          )
            clearSession();
          throw error;
        }
        const retryable =
          axios.isAxiosError(error) &&
          (!error.response || (status !== undefined && status >= 500));
        if (!retryable || attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
    throw new Error("Не удалось обновить сессию");
  };
  const operation = (async (): Promise<TokenPair> => {
    if (navigator.locks?.request)
      return await navigator.locks.request(
        "timeleak-auth-refresh",
        performRefresh,
      );
    return performRefresh();
  })();
  refreshFlight = operation.finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}
type RetryConfig = InternalAxiosRequestConfig & {
  _tlRetry?: boolean;
  _tlToken?: string;
  _tlIdentity?: string | null;
};
api.interceptors.request.use(async (config: RetryConfig) => {
  if (!config._tlRetry) config._tlIdentity = getSessionIdentity();
  let token = getAccessToken();
  if (
    !config._tlRetry &&
    (token ? shouldRefresh(token) : localStorage.getItem(REFRESH_KEY))
  ) {
    // A temporary network failure must leave the stored session intact.
    token = (await refreshSession()).access_token;
  }
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  config._tlToken = token || undefined;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; code?: string }>) => {
    const config = error.config as RetryConfig | undefined;
    if (!config) throw error;
    if (
      /\/auth\/(?:login|refresh|register|otp|password-reset)(?:\/|$)/.test(
        config.url || "",
      )
    )
      throw error;
    if (config._tlIdentity && getSessionIdentity() !== config._tlIdentity) {
      throw new Error("Аккаунт изменился. Повторите действие.");
    }
    if (
      error.response?.status === 403 &&
      [error.response.data?.error, error.response.data?.code].includes(
        "account_deactivated",
      )
    )
      clearSession();
    if (error.response?.status !== 401) throw error;
    if (config._tlRetry) {
      clearSession();
      throw error;
    }
    config._tlRetry = true;
    // A concurrent request may already have rotated the token after this request left.
    const current = getAccessToken();
    const token =
      current && current !== config._tlToken
        ? current
        : (await refreshSession()).access_token;
    config.headers.set("Authorization", `Bearer ${token}`);
    return api.request(config);
  },
);

export const auth = {
  requestEmail: async (email: string) =>
    (
      await publicApi.post<EmailOtpRequest>("/api/v1/auth/email-otp/request", {
        email: email.trim().toLowerCase(),
      })
    ).data,
  verifyEmail: async (requestId: string, code: string) =>
    (
      await publicApi.post<{
        request_id: string;
        email: string;
        verified: boolean;
      }>("/api/v1/auth/email-otp/verify", {
        request_id: requestId,
        code: code.trim(),
      })
    ).data,
  async login(phone: string, password: string) {
    try {
      const { data } = await publicApi.post<TokenPair>("/api/v1/auth/login", {
        phone: phone.trim(),
        password: password.trim(),
      });
      saveSession(data);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403)
        throw new Error("Аккаунт отключён");
      throw error;
    }
  },
  requestOtp: async (phone: string) =>
    (
      await publicApi.post<OtpRequest>("/api/v1/auth/otp/request", {
        phone: phone.trim(),
      })
    ).data,
  verifyOtp: async (requestId: string, code: string) =>
    (
      await publicApi.post<OtpVerification>("/api/v1/auth/otp/verify", {
        request_id: requestId,
        code: code.trim(),
      })
    ).data,
  register: async (
    phone: string,
    password: string,
    verificationToken: string,
  ) =>
    (
      await publicApi.post("/api/v1/auth/register", {
        phone: phone.trim(),
        password,
        confirm_password: password,
        verification_token: verificationToken,
      })
    ).data,
  requestReset: async (phone: string) =>
    (
      await publicApi.post<OtpRequest>(
        "/api/v1/auth/password-reset/otp/request",
        { phone: phone.trim() },
      )
    ).data,
  verifyReset: async (requestId: string, code: string) =>
    (
      await publicApi.post<OtpVerification>(
        "/api/v1/auth/password-reset/otp/verify",
        { request_id: requestId, code: code.trim() },
      )
    ).data,
  confirmReset: async (
    phone: string,
    password: string,
    verificationToken: string,
  ) =>
    (
      await publicApi.post("/api/v1/auth/password-reset/confirm", {
        phone: phone.trim(),
        new_password: password,
        confirm_password: password,
        verification_token: verificationToken,
      })
    ).data,
};
const notesPath = "/api/v1/auth/notes";
export const notesApi = {
  async meta(from: string, to: string) {
    const all: NoteMeta[] = [];
    for (let page = 1; ; page++) {
      const { data } = await api.get<NotesMetaResponse>(notesPath, {
        params: { from, to, fields: "meta", page, limit: 100 },
      });
      all.push(...(data.data || []));
      if (!data.has_more || !data.data?.length) break;
    }
    return all;
  },
  byDate: async (date: string) =>
    (
      await api.get<NotesByDateResponse>(`${notesPath}/by-date`, {
        params: { date },
      })
    ).data.data || [],
  get: async (id: string) =>
    (await api.get<Note>(`${notesPath}/${encodeURIComponent(id)}`)).data,
  create: async (form: FormData, onProgress?: (percent: number) => void) =>
    (
      await api.post<Note>(notesPath, form, {
        onUploadProgress: (event) =>
          onProgress?.(
            event.total ? Math.round((event.loaded * 100) / event.total) : 0,
          ),
      })
    ).data,
  update: async (
    id: string,
    form: FormData,
    onProgress?: (percent: number) => void,
  ) =>
    (
      await api.put<Note>(`${notesPath}/${encodeURIComponent(id)}`, form, {
        onUploadProgress: (event) =>
          onProgress?.(
            event.total ? Math.round((event.loaded * 100) / event.total) : 0,
          ),
      })
    ).data,
  remove: async (id: string) => {
    await api.delete(`${notesPath}/${encodeURIComponent(id)}`);
  },
  deleteTitleAudio: async (id: string) =>
    (
      await api.delete<Note>(
        `${notesPath}/${encodeURIComponent(id)}/title-audio`,
      )
    ).data,
  share: async (id: string, expiresInHours = 168) =>
    (
      await api.post<NoteShare>(
        `${notesPath}/${encodeURIComponent(id)}/share`,
        { expires_in: expiresInHours },
      )
    ).data,
};
export const accountApi = {
  me: async () => (await api.get<UserProfile>("/api/v1/me")).data,
  remove: async (userId: string) => {
    await api.delete("/api/delete/user", { data: { user_id: userId } });
    clearSession();
  },
};
export const reminderEmailApi = {
  get: async () =>
    (await api.get<EmailReminderContact>("/api/v1/auth/email-reminders")).data,
  verify: async (
    requestId: string,
    code: string,
    enabled: boolean,
    language: string,
  ) =>
    (
      await api.post<EmailReminderContact>(
        "/api/v1/auth/email-reminders/verify",
        { request_id: requestId, code: code.trim(), enabled, language },
      )
    ).data,
  update: async (enabled: boolean, language?: string) =>
    (
      await api.put<EmailReminderContact>("/api/v1/auth/email-reminders", {
        enabled,
        ...(language === undefined ? {} : { language }),
      })
    ).data,
};
export async function getAd(): Promise<Ad | null> {
  const response = await api.get<Ad>("/api/v1/ads/next");
  return response.status === 204 ? null : response.data;
}
export const getSharedNote = async (token: string) =>
  (
    await publicApi.get<SharedNote>(
      `/api/v1/notes/shared/${encodeURIComponent(token)}`,
    )
  ).data;
export async function fetchNoteFile(
  url: string,
  isPublic = false,
): Promise<Blob> {
  const absolute = new URL(url, `${API_URL}/`);
  // Never forward a user's access token to arbitrary attachment origins.
  const ownOrigin = absolute.origin === new URL(API_URL).origin;
  const signed = absolute.searchParams.has("signature");
  const client = isPublic || signed || !ownOrigin ? publicApi : api;
  const config: AxiosRequestConfig = { responseType: "blob", timeout: 120_000 };
  const blob = (await client.get<Blob>(absolute.href, config)).data;
  // Signed share routes intentionally hide file extensions and may use the
  // generic binary MIME; recognize PDFs for the document viewer.
  if (
    blob.type !== "application/pdf" &&
    (await blob.slice(0, 5).text()) === "%PDF-"
  ) {
    return new Blob([blob], { type: "application/pdf" });
  }
  return blob;
}
