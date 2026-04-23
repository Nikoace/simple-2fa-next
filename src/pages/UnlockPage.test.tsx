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

vi.mock("@/stores/vault", () => ({
  useVaultStore: vi.fn(),
}));

import * as vaultMod from "@/stores/vault";
import { UnlockPage } from "./UnlockPage";

beforeEach(() => {
  navigateMock.mockClear();
  unlockMock.mockResolvedValue(undefined);
  vi.mocked(vaultMod.useVaultStore).mockReturnValue({
    unlock: unlockMock,
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
      status: "unlocked",
      error: null,
    } as ReturnType<typeof vaultMod.useVaultStore>);

    render(<UnlockPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
  });

  it("shows error from vault store", async () => {
    vi.mocked(vaultMod.useVaultStore).mockReturnValue({
      unlock: unlockMock,
      status: "locked",
      error: "wrong password",
    } as ReturnType<typeof vaultMod.useVaultStore>);

    render(<UnlockPage />);

    expect(screen.getByText(/wrong password/i)).toBeTruthy();
  });
});
