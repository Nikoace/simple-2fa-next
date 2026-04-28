import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  configureSync: vi.fn(),
  syncNow: vi.fn(),
  getSyncStatus: vi.fn(),
  disableSync: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

import * as tauri from "@/lib/tauri";
import { SyncSettingsPage } from "./SyncSettingsPage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tauri.getSyncStatus).mockResolvedValue({
    lastSync: null,
    lastError: null,
    inProgress: false,
  });
  vi.mocked(tauri.syncNow).mockResolvedValue({
    lastSync: "2026-04-24T10:00:00Z",
    lastError: null,
    inProgress: false,
  });
});

describe("SyncSettingsPage", () => {
  it("renders provider options", async () => {
    render(<SyncSettingsPage />);
    const select = await screen.findByLabelText(/provider|同步方式|プロバイダー/i);
    expect(select).toBeTruthy();
    expect(screen.getByRole("option", { name: "WebDAV" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "S3" })).toBeTruthy();
  });

  it("submits WebDAV config", async () => {
    const user = userEvent.setup();
    render(<SyncSettingsPage />);

    await user.selectOptions(screen.getByLabelText(/provider|同步方式|プロバイダー/i), "WebDav");
    await user.type(
      screen.getByLabelText(/webdav url|webdav 地址|webdav url/i),
      "https://dav.example.com",
    );
    await user.type(
      screen.getByLabelText(/webdav username|webdav 用户名|webdav ユーザー名/i),
      "alice",
    );
    await user.type(screen.getByLabelText(/webdav password|webdav 密码|webdav パスワード/i), "pw");
    await user.clear(
      screen.getByLabelText(/webdav remote path|webdav 远程路径|webdav リモートパス/i),
    );
    await user.type(
      screen.getByLabelText(/webdav remote path|webdav 远程路径|webdav リモートパス/i),
      "vault.s2fa",
    );

    await user.click(screen.getByRole("button", { name: /save|保存|保存/i }));

    await waitFor(() => {
      expect(tauri.configureSync).toHaveBeenCalledWith({
        type: "WebDav",
        url: "https://dav.example.com",
        username: "alice",
        password: "pw",
        remotePath: "vault.s2fa",
      });
    });
  });

  it("runs sync now and updates status", async () => {
    const user = userEvent.setup();
    render(<SyncSettingsPage />);

    await user.click(screen.getByRole("button", { name: /sync now|立即同步|今すぐ同期/i }));

    await waitFor(() => {
      expect(tauri.syncNow).toHaveBeenCalled();
      expect(screen.getByText(/2026/)).toBeTruthy();
    });
  });
});
