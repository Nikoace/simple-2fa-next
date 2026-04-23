import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  exportVaultToFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

import { save } from "@tauri-apps/plugin-dialog";

import * as tauri from "@/lib/tauri";
import { ExportDialog } from "./ExportDialog";

describe("ExportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports to selected path with password", async () => {
    const user = userEvent.setup();
    vi.mocked(save).mockResolvedValue("/tmp/backup.s2fa");
    vi.mocked(tauri.exportVaultToFile).mockResolvedValue();

    render(<ExportDialog open onClose={vi.fn()} />);

    await user.type(
      screen.getByLabelText(/export password|导出密码|エクスポート用パスワード/i),
      "test123",
    );
    await user.type(
      screen.getByLabelText(/confirm password|确认密码|確認用パスワード/i),
      "test123",
    );
    await user.click(screen.getByRole("button", { name: /export|导出|エクスポート/i }));

    await waitFor(() => {
      expect(tauri.exportVaultToFile).toHaveBeenCalledWith("/tmp/backup.s2fa", "test123");
    });
  });
});
