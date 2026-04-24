import { render, screen, waitFor } from "@testing-library/react";
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
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/import/ExportDialog", () => ({
  ExportDialog: () => null,
}));

vi.mock("@/components/import/ImportDialog", () => ({
  ImportDialog: () => null,
}));

import * as tauri from "@/lib/tauri";
import * as vaultStore from "@/stores/vault";
import type { StoreApi, UseBoundStore } from "zustand";
import * as settingsStore from "@/stores/settings";
import { AppShell } from "./AppShell";

type VaultStatus = "loading" | "uninitialized" | "locked" | "unlocked" | "error";

function mockVaultStatus(status: VaultStatus) {
  const noop = async () => {};
  vi.mocked(vaultStore.useVaultStore).mockImplementation(
    (selector: Parameters<UseBoundStore<StoreApi<{ status: VaultStatus; lock: () => Promise<void>; error: string | null; checkStatus: () => Promise<void>; setup: () => Promise<void>; unlock: () => Promise<void>; unlockByBiometric: () => Promise<void> }>>>[0]) =>
      selector({ status, lock: noop, error: null, checkStatus: noop, setup: noop, unlock: noop, unlockByBiometric: noop }),
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
