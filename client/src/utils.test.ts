import { describe, it, expect } from "vitest";
import { dateKey, parseDate, monthDays, badgeCount, noteDates } from "./utils";
import type { NoteMeta } from "./types";
const note = {
  id: "1",
  note_date: "2026-11-04",
  createdAt: "2026-11-04T00:00:00Z",
  occurrences: ["2027-11-04"],
  lifecycle: "one_time",
  is_completed: false,
} as NoteMeta;
describe("calendar local dates", () => {
  it("preserves local calendar day without UTC conversion", () =>
    expect(dateKey(new Date(2026, 10, 4))).toBe("2026-11-04"));
  it("round trips selected dates", () =>
    expect(dateKey(parseDate("2027-03-14"))).toBe("2027-03-14"));
  it("uses Monday weeks without extra rows", () => {
    const days = monthDays(new Date(2021, 1, 1));
    expect(days).toHaveLength(28);
    expect(days[0].getDay()).toBe(1);
  });
  it("includes spillover days in six-week months", () => {
    const days = monthDays(new Date(2026, 10, 1));
    expect(days).toHaveLength(42);
    expect(dateKey(days[0])).toBe("2026-10-26");
  });
  it("shows recurring occurrences once each", () =>
    expect(
      noteDates({ ...note, occurrences: ["2026-11-04", "2027-11-04"] }),
    ).toEqual(["2026-11-04", "2027-11-04"]));
  it("hides past one-time notes and completed badge entries", () => {
    expect(badgeCount([note], "2026-11-03", "2026-11-04")).toBe(0);
    expect(
      badgeCount(
        [{ ...note, lifecycle: "recurring" }],
        "2026-11-03",
        "2026-11-04",
      ),
    ).toBe(1);
    expect(
      badgeCount([{ ...note, is_completed: true }], "2026-11-04", "2026-11-04"),
    ).toBe(1);
  });
});
