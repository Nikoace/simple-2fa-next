import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/lib/tauri", () => ({
  unlockVault: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { UnlockPage } from "./UnlockPage";

describe("UnlockPage", () => {
  it("submits password and calls unlockVault", async () => {
    vi.mocked(tauri.unlockVault).mockResolvedValue();

    render(<UnlockPage />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/master password|主密码|マスターパスワード/i),
      "secret",
    );
    await user.click(screen.getByRole("button", { name: /unlock|解锁|解錠/i }));

    await waitFor(() => expect(tauri.unlockVault).toHaveBeenCalledWith("secret"));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
  });

  it("shows wrong password error on failure", async () => {
    vi.mocked(tauri.unlockVault).mockRejectedValue(new Error("wrong password"));

    render(<UnlockPage />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/master password|主密码|マスターパスワード/i),
      "bad",
    );
    await user.click(screen.getByRole("button", { name: /unlock|解锁|解錠/i }));

    await waitFor(() => {
      expect(screen.getByText(/wrong password|密码错误|パスワードが違います/i)).toBeTruthy();
    });
  });
});
