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
  setupVault: vi.fn(),
  unlockVault: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { SetupPage } from "./SetupPage";

describe("SetupPage", () => {
  it("submits password and navigates to /", async () => {
    vi.mocked(tauri.setupVault).mockResolvedValue();
    vi.mocked(tauri.unlockVault).mockResolvedValue();

    render(<SetupPage />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/master password|主密码|マスターパスワード/i),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /create vault|创建 vault|vault を作成/i }));

    await waitFor(() => expect(tauri.setupVault).toHaveBeenCalledWith("password123"));
    await waitFor(() => expect(tauri.unlockVault).toHaveBeenCalledWith("password123"));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
  });
});
