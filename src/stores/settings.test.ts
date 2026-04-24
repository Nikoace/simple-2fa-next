import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, useSettingsStore } from "./settings";

beforeEach(() => {
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyTheme", () => {
  it("adds dark class for 'dark' theme", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class for 'light' theme", () => {
    document.documentElement.classList.add("dark");
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows system dark preference for 'system' theme", () => {
    vi.spyOn(globalThis, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows system light preference for 'system' theme", () => {
    vi.spyOn(globalThis, "matchMedia").mockReturnValue({
      matches: false,
    } as MediaQueryList);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("useSettingsStore", () => {
  it("defaults biometricEnabled to false", () => {
    expect(useSettingsStore.getState().biometricEnabled).toBe(false);
  });

  it("updates biometricEnabled", () => {
    useSettingsStore.getState().setBiometricEnabled(true);
    expect(useSettingsStore.getState().biometricEnabled).toBe(true);
  });
});
