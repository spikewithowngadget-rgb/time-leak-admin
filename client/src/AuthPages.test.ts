// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { finishLogin } from "./AuthPages";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("returns to a reminder's calendar day after sign-in and consumes the target", () => {
  sessionStorage.setItem("tl_return_to", "/?date=2028-02-29");
  const navigate = vi.fn();
  finishLogin(navigate);
  expect(navigate).toHaveBeenCalledWith("/?date=2028-02-29");
  expect(sessionStorage.getItem("tl_return_to")).toBeNull();
});

it("prioritizes a pending share and clears both saved destinations", () => {
  sessionStorage.setItem("tl_return_to", "/?date=2026-11-04");
  sessionStorage.setItem("tl_pending_share", "share/token");
  const navigate = vi.fn();
  finishLogin(navigate);
  expect(navigate).toHaveBeenCalledWith("/share/share%2Ftoken");
  expect(sessionStorage.getItem("tl_return_to")).toBeNull();
  expect(sessionStorage.getItem("tl_pending_share")).toBeNull();
});

it("returns to the exact email reminder preferences after sign-in", () => {
  sessionStorage.setItem("tl_return_to", "/about#email-reminders");
  const navigate = vi.fn();
  finishLogin(navigate);
  expect(navigate).toHaveBeenCalledWith("/about#email-reminders");
  expect(sessionStorage.getItem("tl_return_to")).toBeNull();
});

it.each([
  "https://example.org",
  "//example.org",
  "/?date=2027-02-29",
  "/?date=2026-11-04&next=https://example.org",
  "/?date=2026-99-01",
  "/about#email-reminders?next=https://example.org",
])("rejects unsafe or invalid reminder destination %s", (target) => {
  sessionStorage.setItem("tl_return_to", target);
  const navigate = vi.fn();
  finishLogin(navigate);
  expect(navigate).toHaveBeenCalledWith("/");
});
