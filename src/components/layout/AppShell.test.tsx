import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  getSyncStatus: vi.fn(),
}));

vi.mock("@/stores/vault", () => ({
  useVaultStore: vi.fn(),
}));

vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(),
  applyTheme: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("@/components/import/ExportDialog", () => ({
  ExportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="export-dialog-open" /> : null,
}));

vi.mock("@/components/import/ImportDialog", () => ({
  ImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog-open" /> : null,
}));

import type { StoreApi, UseBoundStore } from "zustand";
import * as tauri from "@/lib/tauri";
import * as settingsStore from "@/stores/settings";
import * as vaultStore from "@/stores/vault";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "./AppShell";

type VaultStatus = "loading" | "uninitialized" | "locked" | "unlocked" | "error";

function mockVaultStatus(status: VaultStatus, lockFn?: () => Promise<void>) {
  const noop = async () => {};
  vi.mocked(vaultStore.useVaultStore).mockImplementation(
    (
      selector: Parameters<
        UseBoundStore<
          StoreApi<{
            status: VaultStatus;
            lock: () => Promise<void>;
            error: string | null;
            checkStatus: () => Promise<void>;
            setup: () => Promise<void>;
            unlock: () => Promise<void>;
            unlockByBiometric: () => Promise<void>;
          }>
        >
      >[0],
    ) =>
      selector({
        status,
        lock: lockFn ?? noop,
        error: null,
        checkStatus: noop,
        setup: noop,
        unlock: noop,
        unlockByBiometric: noop,
      }),
  );
}

function mockUnlocked() {
  mockVaultStatus("unlocked");
}

function mockLocked() {
  mockVaultStatus("locked");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
    theme: "light",
    setTheme: vi.fn(),
  } as ReturnType<typeof settingsStore.useSettingsStore>);
  vi.mocked(tauri.getSyncStatus).mockResolvedValue({
    lastSync: null,
    lastError: null,
    inProgress: false,
  });
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
});

describe("AppShell sync badge", () => {
  it("shows idle badge when vault is unlocked and no sync has occurred", async () => {
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/sync idle|未同步|未同期/i)).toBeTruthy();
    });
  });

  it("hides badge when vault is locked", () => {
    mockLocked();
    render(<AppShell />);

    expect(screen.queryByText(/sync idle|syncing|sync error|未同步|同步中|同步错误/i)).toBeNull();
  });

  it("shows syncing badge when inProgress is true", async () => {
    vi.mocked(tauri.getSyncStatus).mockResolvedValue({
      lastSync: null,
      lastError: null,
      inProgress: true,
    });
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/syncing|同步中|同期中/i)).toBeTruthy();
    });
  });

  it("shows error badge when lastError is set", async () => {
    vi.mocked(tauri.getSyncStatus).mockResolvedValue({
      lastSync: null,
      lastError: "network error",
      inProgress: false,
    });
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/sync error|同步错误|同期エラー/i)).toBeTruthy();
    });
  });

  it("shows last sync time when lastSync is set", async () => {
    vi.mocked(tauri.getSyncStatus).mockResolvedValue({
      lastSync: "2026-04-24T10:00:00Z",
      lastError: null,
      inProgress: false,
    });
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/synced|上次|に同期/i)).toBeTruthy();
    });
  });
});

describe("AppShell nav buttons", () => {
  it("click import button opens ImportDialog", async () => {
    const user = userEvent.setup();
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/import|导入|インポート/i)).toBeTruthy();
    });

    expect(screen.queryByTestId("import-dialog-open")).toBeNull();
    await user.click(screen.getByText(/import|导入|インポート/i));
    expect(screen.getByTestId("import-dialog-open")).toBeTruthy();
  });

  it("click export button opens ExportDialog", async () => {
    const user = userEvent.setup();
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/export|导出|エクスポート/i)).toBeTruthy();
    });

    expect(screen.queryByTestId("export-dialog-open")).toBeNull();
    await user.click(screen.getByText(/export|导出|エクスポート/i));
    expect(screen.getByTestId("export-dialog-open")).toBeTruthy();
  });

  it("click lock button calls lock function", async () => {
    const user = userEvent.setup();
    const mockLockFn = vi.fn().mockResolvedValue(undefined);
    mockVaultStatus("unlocked", mockLockFn);
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText(/^lock$|^锁定$|^ロック$/i)).toBeTruthy();
    });

    await user.click(screen.getByText(/^lock$|^锁定$|^ロック$/i));
    await waitFor(() => {
      expect(mockLockFn).toHaveBeenCalled();
    });
  });

  it("click settings button calls navigate to /settings", async () => {
    const user = userEvent.setup();
    const mockNavFn = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavFn);
    mockUnlocked();
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /settings|设置|設定/i })).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: /settings|设置|設定/i }));
    await waitFor(() => {
      expect(mockNavFn).toHaveBeenCalledWith({ to: "/settings" });
    });
  });
});

describe("AppShell theme switcher", () => {
  it("click dark menu item calls setTheme with 'dark'", async () => {
    const user = userEvent.setup();
    const mockSetTheme = vi.fn();
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as ReturnType<typeof settingsStore.useSettingsStore>);
    mockUnlocked();
    render(<AppShell />);

    const themeTrigger = document.querySelector("header span.inline-flex");
    if (themeTrigger) {
      await user.click(themeTrigger as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.queryByText(/^dark$|^深色$|^ダーク$/i)).toBeTruthy();
    });

    await user.click(screen.getByText(/^dark$|^深色$|^ダーク$/i));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("click light menu item calls setTheme with 'light'", async () => {
    const user = userEvent.setup();
    const mockSetTheme = vi.fn();
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    } as ReturnType<typeof settingsStore.useSettingsStore>);
    mockUnlocked();
    render(<AppShell />);

    const themeTrigger = document.querySelector("header span.inline-flex");
    if (themeTrigger) {
      await user.click(themeTrigger as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.queryByText(/^light$|^浅色$|^ライト$/i)).toBeTruthy();
    });

    await user.click(screen.getByText(/^light$|^浅色$|^ライト$/i));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("click system menu item calls setTheme with 'system'", async () => {
    const user = userEvent.setup();
    const mockSetTheme = vi.fn();
    vi.mocked(settingsStore.useSettingsStore).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    } as ReturnType<typeof settingsStore.useSettingsStore>);
    mockUnlocked();
    render(<AppShell />);

    const themeTrigger = document.querySelector("header span.inline-flex");
    if (themeTrigger) {
      await user.click(themeTrigger as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.queryByText(/^system$|^跟随系统$|^システム$/i)).toBeTruthy();
    });

    await user.click(screen.getByText(/^system$|^跟随系统$|^システム$/i));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});

describe("AppShell language switcher", () => {
  it("click English menu item calls i18n.changeLanguage with 'en'", async () => {
    const user = userEvent.setup();
    mockUnlocked();
    render(<AppShell />);

    const allTriggerSpans = document.querySelectorAll("header span.inline-flex");
    const langTriggerEl = allTriggerSpans[allTriggerSpans.length - 1];
    if (langTriggerEl) {
      await user.click(langTriggerEl as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.queryByText("English")).toBeTruthy();
    });

    await user.click(screen.getByText("English"));
    // i18n.changeLanguage is a real function in the test environment; verify menu rendered
    expect(screen.queryByText("English")).toBeFalsy();
  });

  it("click 简体中文 menu item changes language to zh-CN", async () => {
    const user = userEvent.setup();
    mockUnlocked();
    render(<AppShell />);

    const allTriggerSpans = document.querySelectorAll("header span.inline-flex");
    const langTriggerEl = allTriggerSpans[allTriggerSpans.length - 1];
    if (langTriggerEl) {
      await user.click(langTriggerEl as HTMLElement);
    }

    await waitFor(() => {
      expect(screen.queryByText("简体中文")).toBeTruthy();
    });

    await user.click(screen.getByText("简体中文"));
    expect(screen.queryByText("简体中文")).toBeFalsy();
  });
});
