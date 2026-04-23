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

const setupMock = vi.fn();

vi.mock("@/stores/vault", () => ({
  useVaultStore: vi.fn(),
}));

import * as vaultMod from "@/stores/vault";
import { SetupPage } from "./SetupPage";

beforeEach(() => {
  navigateMock.mockClear();
  setupMock.mockResolvedValue(undefined);
  vi.mocked(vaultMod.useVaultStore).mockReturnValue({
    setup: setupMock,
    status: "uninitialized",
    error: null,
  } as ReturnType<typeof vaultMod.useVaultStore>);
});

describe("SetupPage", () => {
  it("calls setup with the entered password", async () => {
    render(<SetupPage />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/master password|主密码|マスターパスワード/i),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /create vault|创建 vault|vault を作成/i }));

    await waitFor(() => expect(setupMock).toHaveBeenCalledWith("password123"));
  });

  it("navigates to / when vault status becomes unlocked", async () => {
    vi.mocked(vaultMod.useVaultStore).mockReturnValue({
      setup: setupMock,
      status: "unlocked",
      error: null,
    } as ReturnType<typeof vaultMod.useVaultStore>);

    render(<SetupPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
  });
});
