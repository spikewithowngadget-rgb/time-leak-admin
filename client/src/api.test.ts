// @vitest-environment jsdom
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";

type ApiModule = typeof import("./api");
let client: ApiModule;
const originalAdapter = axios.defaults.adapter;
const jwt = (expiresIn: number, uid = "user") =>
  `e30.${btoa(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + expiresIn }))}.signature`;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({
  config,
  data,
  status,
  statusText: String(status),
  headers: new AxiosHeaders(),
});
const rejectStatus = (config: InternalAxiosRequestConfig, status: number) =>
  Promise.reject(
    new AxiosError(
      "Request failed",
      undefined,
      config,
      undefined,
      response(config, { error: "unauthorized" }, status),
    ),
  );

beforeEach(async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
  vi.stubGlobal("Blob", NodeBlob);
  vi.resetModules();
});
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session refresh", () => {
  it("shares one rotating refresh across concurrent requests and preserves both new tokens", async () => {
    let refreshes = 0;
    let requests = 0;
    const fresh = jwt(300);
    axios.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/refresh")) {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return response(config, {
          access_token: fresh,
          refresh_token: "rotated",
        });
      }
      requests++;
      expect(config.headers.get("Authorization")).toBe(`Bearer ${fresh}`);
      return response(config, { ok: true });
    };
    client = await import("./api");
    client.saveSession({ access_token: jwt(-10), refresh_token: "original" });
    await Promise.all([
      client.api.get("/notes"),
      client.api.get("/me"),
      client.api.get("/ads"),
    ]);
    expect(refreshes).toBe(1);
    expect(requests).toBe(3);
    expect(localStorage.getItem("tl_refresh_token")).toBe("rotated");
  });

  it("does not rotate again when a late 401 belongs to the old access token", async () => {
    let refreshes = 0;
    const fresh = jwt(300);
    const old = jwt(200);
    axios.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/refresh")) {
        refreshes++;
        return response(config, { access_token: fresh, refresh_token: "new" });
      }
      if (config.headers.get("Authorization") === `Bearer ${old}`) {
        if (config.url === "/late")
          await new Promise((resolve) => setTimeout(resolve, 10));
        return rejectStatus(config, 401);
      }
      return response(config, { ok: true });
    };
    client = await import("./api");
    client.saveSession({ access_token: old, refresh_token: "original" });
    await Promise.all([client.api.get("/first"), client.api.get("/late")]);
    expect(refreshes).toBe(1);
  });

  it("keeps the session after three transient refresh failures", async () => {
    let refreshes = 0;
    axios.defaults.adapter = async (config) => {
      refreshes++;
      return rejectStatus(config, 503);
    };
    client = await import("./api");
    const expired = jwt(-10);
    client.saveSession({ access_token: expired, refresh_token: "original" });
    await expect(client.api.get("/notes")).rejects.toBeInstanceOf(AxiosError);
    expect(refreshes).toBe(3);
    expect(localStorage.getItem("tl_refresh_token")).toBe("original");
    expect(client.hasSession()).toBe(true);
  });

  it("logs out only once on invalid refresh with concurrent requests", async () => {
    let refreshes = 0;
    axios.defaults.adapter = async (config) => {
      refreshes++;
      return rejectStatus(config, 401);
    };
    client = await import("./api");
    client.saveSession({ access_token: jwt(-10), refresh_token: "invalid" });
    const changed = vi.fn();
    window.addEventListener(client.AUTH_EVENT, changed);
    try {
      await Promise.allSettled([
        client.api.get("/notes"),
        client.api.get("/me"),
      ]);
      expect(refreshes).toBe(1);
      expect(client.hasSession()).toBe(false);
      expect(changed).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(client.AUTH_EVENT, changed);
    }
  });

  it("does not restore a session if the user logged out while refresh was pending", async () => {
    let complete: (() => void) | undefined;
    axios.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      return response(config, { access_token: jwt(300), refresh_token: "new" });
    };
    client = await import("./api");
    client.saveSession({ access_token: jwt(-10), refresh_token: "original" });
    const pending = client.refreshSession();
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    client.clearSession();
    complete?.();
    await expect(pending).rejects.toThrow("Сессия изменилась");
    expect(client.hasSession()).toBe(false);
  });

  it("reuses another tab’s rotated tokens after acquiring the browser-wide lock", async () => {
    const fresh = jwt(300);
    const lock = vi.fn(
      async (_name: string, callback: () => Promise<unknown>) => {
        localStorage.setItem("tl_access_token", fresh);
        localStorage.setItem("tl_refresh_token", "from-other-tab");
        return callback();
      },
    );
    vi.stubGlobal("navigator", { locks: { request: lock } });
    const request = vi.fn(async (config: InternalAxiosRequestConfig) => {
      expect(config.url).toBe("/notes");
      expect(config.headers.get("Authorization")).toBe(`Bearer ${fresh}`);
      return response(config, { ok: true });
    });
    axios.defaults.adapter = request;
    client = await import("./api");
    client.saveSession({ access_token: jwt(-10), refresh_token: "old" });
    await client.api.get("/notes");
    expect(lock).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not retry a previous account's request with a new account's credentials", async () => {
    const second = jwt(300, "second-user");
    const request = vi.fn(async (config: InternalAxiosRequestConfig) => {
      localStorage.setItem("tl_access_token", second);
      localStorage.setItem("tl_refresh_token", "second-refresh");
      return rejectStatus(config, 401);
    });
    axios.defaults.adapter = request;
    client = await import("./api");
    client.saveSession({
      access_token: jwt(300, "first-user"),
      refresh_token: "first-refresh",
    });
    await expect(
      client.api.post("/notes", { title: "private" }),
    ).rejects.toThrow("Аккаунт изменился");
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.getSessionIdentity()).toBe("second-user");
    expect(localStorage.getItem("tl_refresh_token")).toBe("second-refresh");
  });

  it("does not undo a logout from another tab while refresh was pending", async () => {
    let complete: (() => void) | undefined;
    axios.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      return response(config, { access_token: jwt(300), refresh_token: "new" });
    };
    client = await import("./api");
    client.saveSession({ access_token: jwt(-10), refresh_token: "original" });
    const pending = client.refreshSession();
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    localStorage.removeItem("tl_access_token");
    localStorage.removeItem("tl_refresh_token");
    complete?.();
    await expect(pending).rejects.toThrow("Сессия изменилась");
    expect(client.hasSession()).toBe(false);
  });
});

it("never forwards the bearer token to external or signed attachments", async () => {
  axios.defaults.adapter = async (config) => {
    expect(config.headers.has("Authorization")).toBe(false);
    return response(config, new Blob(["file"]));
  };
  client = await import("./api");
  client.saveSession({ access_token: jwt(300), refresh_token: "original" });
  await client.fetchNoteFile("https://files.example.org/attachment.jpg");
  await client.fetchNoteFile(
    "https://api.timeleak.kz/api/v1/notes/shared/token/files/0?signature=signed",
  );
});

it("recognizes a PDF behind a signed extensionless download route", async () => {
  axios.defaults.adapter = async (config) =>
    response(
      config,
      new Blob(["%PDF-1.7\nexample"], { type: "application/octet-stream" }),
    );
  client = await import("./api");
  const file = await client.fetchNoteFile(
    "https://api.timeleak.kz/api/v1/notes/shared/token/files/0?signature=signed",
  );
  expect(file.type).toBe("application/pdf");
  expect(await file.text()).toBe("%PDF-1.7\nexample");
});
