import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  biometricAvailable: vi.fn(),
  enableBiometric: vi.fn(),
  disableBiometric: vi.fn(),
}));

vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

import * as tauriMod from "@/lib/tauri";
import * as settingsMod from "@/stores/settings";
import { SettingsPage } from "./SettingsPage";

const setBiometricEnabledMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tauriMod.biometricAvailable).mockResolvedValue(true);
  vi.mocked(settingsMod.useSettingsStore).mockImplementation(
    (selector: (state: settingsMod.SettingsState) => unknown) =>
      selector({
        theme: "system",
        setTheme: vi.fn(),
        biometricEnabled: false,
        setBiometricEnabled: setBiometricEnabledMock,
      }),
  );
});

describe("SettingsPage", () => {
  it("renders biometric switch", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeTruthy();
    });
  });

  it("enables biometric after password confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriMod.enableBiometric).mockResolvedValue(undefined);

    render(<SettingsPage />);

    await user.click(screen.getByRole("switch"));
    await user.type(screen.getByLabelText(/master password|主密码|マスターパスワード/i), "pw");
    await user.click(screen.getByRole("button", { name: /confirm|确认|確認/i }));

    await waitFor(() => {
      expect(tauriMod.enableBiometric).toHaveBeenCalledWith("pw");
      expect(setBiometricEnabledMock).toHaveBeenCalledWith(true);
    });
  });

  it("disables biometric when already enabled", async () => {
    const user = userEvent.setup();
    vi.mocked(tauriMod.disableBiometric).mockResolvedValue(undefined);
    vi.mocked(settingsMod.useSettingsStore).mockImplementation(
      (selector: (state: settingsMod.SettingsState) => unknown) =>
        selector({
          theme: "system",
          setTheme: vi.fn(),
          biometricEnabled: true,
          setBiometricEnabled: setBiometricEnabledMock,
        }),
    );

    render(<SettingsPage />);
    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(tauriMod.disableBiometric).toHaveBeenCalled();
      expect(setBiometricEnabledMock).toHaveBeenCalledWith(false);
    });
  });
});
