import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const unlockMock = vi.fn();
const unlockByBiometricMock = vi.fn();

vi.mock("@/lib/tauri", () => ({
  biometricAvailable: vi.fn(),
}));

vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("@/stores/vault", () => ({
  useVaultStore: vi.fn(),
}));

import * as tauriMod from "@/lib/tauri";
import * as settingsMod from "@/stores/settings";
import * as vaultMod from "@/stores/vault";
import { UnlockPage } from "./UnlockPage";

beforeEach(() => {
  navigateMock.mockClear();
  unlockMock.mockResolvedValue(undefined);
  unlockByBiometricMock.mockResolvedValue(undefined);
  vi.mocked(tauriMod.biometricAvailable).mockResolvedValue(false);
  vi.mocked(settingsMod.useSettingsStore).mockImplementation(
    (selector: (state: settingsMod.SettingsState) => unknown) =>
      selector({
        theme: "system",
        setTheme: vi.fn(),
        biometricEnabled: false,
        setBiometricEnabled: vi.fn(),
      }),
  );
  vi.mocked(vaultMod.useVaultStore).mockReturnValue({
    unlock: unlockMock,
    unlockByBiometric: unlockByBiometricMock,
    status: "locked",
    error: null,
  } as ReturnType<typeof vaultMod.useVaultStore>);
});

describe("UnlockPage", () => {
  it("calls unlock with the entered password", async () => {
    render(<UnlockPage />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/master password|主密码|マスターパスワード/i),
      "secret",
    );
    await user.click(screen.getByRole("button", { name: /unlock|解锁|解錠/i }));

    await waitFor(() => expect(unlockMock).toHaveBeenCalledWith("secret"));
  });

  it("navigates to / when vault status becomes unlocked", async () => {
    vi.mocked(vaultMod.useVaultStore).mockReturnValue({
      unlock: unlockMock,
      unlockByBiometric: unlockByBiometricMock,
      status: "unlocked",
      error: null,
    } as ReturnType<typeof vaultMod.useVaultStore>);

    render(<UnlockPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
  });

  it("shows error from vault store", async () => {
    vi.mocked(vaultMod.useVaultStore).mockReturnValue({
      unlock: unlockMock,
      unlockByBiometric: unlockByBiometricMock,
      status: "locked",
      error: "wrong password",
    } as ReturnType<typeof vaultMod.useVaultStore>);

    render(<UnlockPage />);

    expect(screen.getByText(/wrong password/i)).toBeTruthy();
  });

  it("shows biometric button when available and enabled", async () => {
    vi.mocked(tauriMod.biometricAvailable).mockResolvedValue(true);
    vi.mocked(settingsMod.useSettingsStore).mockImplementation(
      (selector: (state: settingsMod.SettingsState) => unknown) =>
        selector({
          theme: "system",
          setTheme: vi.fn(),
          biometricEnabled: true,
          setBiometricEnabled: vi.fn(),
        }),
    );

    render(<UnlockPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /biometric|生物识别|生体認証/i })).toBeTruthy();
    });
  });

  it("calls biometric unlock when biometric button clicked", async () => {
    vi.mocked(tauriMod.biometricAvailable).mockResolvedValue(true);
    vi.mocked(settingsMod.useSettingsStore).mockImplementation(
      (selector: (state: settingsMod.SettingsState) => unknown) =>
        selector({
          theme: "system",
          setTheme: vi.fn(),
          biometricEnabled: true,
          setBiometricEnabled: vi.fn(),
        }),
    );

    render(<UnlockPage />);

    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /biometric|生物识别|生体認証/i })).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: /biometric|生物识别|生体認証/i }));

    await waitFor(() => expect(unlockByBiometricMock).toHaveBeenCalled());
  });

  it("does not render biometric button when unavailable", async () => {
    vi.mocked(tauriMod.biometricAvailable).mockResolvedValue(false);
    vi.mocked(settingsMod.useSettingsStore).mockImplementation(
      (selector: (state: settingsMod.SettingsState) => unknown) =>
        selector({
          theme: "system",
          setTheme: vi.fn(),
          biometricEnabled: true,
          setBiometricEnabled: vi.fn(),
        }),
    );

    render(<UnlockPage />);

    await waitFor(() => {
      expect(tauriMod.biometricAvailable).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: /biometric|生物识别|生体認証/i })).toBeNull();
  });
});
