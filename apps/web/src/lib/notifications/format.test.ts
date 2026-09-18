import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatFriendlyDate, formatFriendlyTime } from "./format";

describe("formatFriendlyDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'hoje' for today's date", () => {
    expect(formatFriendlyDate("2026-06-10")).toBe("hoje");
  });

  it("returns 'amanhã' for tomorrow's date", () => {
    expect(formatFriendlyDate("2026-06-11")).toBe("amanhã");
  });

  it("returns DD/MM for any other future date", () => {
    expect(formatFriendlyDate("2026-06-19")).toBe("19/06");
  });

  it("returns DD/MM for a past date", () => {
    expect(formatFriendlyDate("2026-06-05")).toBe("05/06");
  });

  it("handles a full timestamp, not just a plain date", () => {
    expect(formatFriendlyDate("2026-06-10T12:00:00.000Z")).toBe("hoje");
  });
});

describe("formatFriendlyTime", () => {
  it("strips seconds from HH:MM:SS", () => {
    expect(formatFriendlyTime("18:30:00")).toBe("18:30");
  });

  it("leaves an already-short HH:MM value untouched", () => {
    expect(formatFriendlyTime("09:05")).toBe("09:05");
  });
});
