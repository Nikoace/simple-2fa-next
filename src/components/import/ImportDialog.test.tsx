import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  importS2faFile: vi.fn(),
  parseOtpauthUri: vi.fn(),
  commitImport: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { open } from "@tauri-apps/plugin-dialog";

import * as tauri from "@/lib/tauri";
import { ImportDialog } from "./ImportDialog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("ImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches between file and uri modes", async () => {
    const user = userEvent.setup();
    render(<ImportDialog open onClose={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /uri/i }));
    expect(screen.getByLabelText(/otpauth/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /file|文件|ファイル/i }));
    expect(
      screen.getByRole("button", { name: /choose file|选择文件|ファイルを選択/i }),
    ).toBeInTheDocument();
  });

  it("imports accounts from selected file", async () => {
    const user = userEvent.setup();
    vi.mocked(open).mockResolvedValue("/tmp/sample.s2fa");
    vi.mocked(tauri.importS2faFile).mockResolvedValue({
      sourceVersion: 1,
      items: [
        {
          name: "alice@example.com",
          issuer: "GitHub",
          secret: "JBSWY3DPEHPK3PXP",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
        },
      ],
    });
    vi.mocked(tauri.commitImport).mockResolvedValue([]);

    render(<ImportDialog open onClose={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /choose file|选择文件|ファイルを選択/i }));
    await user.type(
      screen.getByLabelText(/export password|导出密码|エクスポート用パスワード/i),
      "test123",
    );
    await user.click(screen.getByRole("button", { name: /preview|预览|プレビュー/i }));

    await waitFor(() => {
      expect(screen.getByText(/alice@example.com/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /confirm import|确认导入|インポートを確定/i }),
    );
    await waitFor(() => expect(tauri.commitImport).toHaveBeenCalledTimes(1));
  });

  it("shows preview item without issuer prefix", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.parseOtpauthUri).mockResolvedValue({
      name: "alice@example.com",
      issuer: undefined,
      secret: "JBSWY3DPEHPK3PXP",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });

    render(<ImportDialog open onClose={vi.fn()} />, { wrapper });
    await user.click(screen.getByRole("button", { name: /uri/i }));
    await user.type(screen.getByLabelText(/otpauth/i), "otpauth://totp/alice%40example.com");
    await user.click(screen.getByRole("button", { name: /preview|预览/i }));

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
  });

  it("shows error message when parseOtpauthUri fails", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.parseOtpauthUri).mockRejectedValue(new Error("invalid uri"));

    render(<ImportDialog open onClose={vi.fn()} />, { wrapper });
    await user.click(screen.getByRole("button", { name: /uri/i }));
    await user.type(screen.getByLabelText(/otpauth/i), "bad-uri");
    await user.click(screen.getByRole("button", { name: /preview|预览/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid uri/i)).toBeInTheDocument();
    });
  });

  it("parses uri and commits selected item", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.parseOtpauthUri).mockResolvedValue({
      name: "alice@example.com",
      issuer: "GitHub",
      secret: "JBSWY3DPEHPK3PXP",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    vi.mocked(tauri.commitImport).mockResolvedValue([]);

    render(<ImportDialog open onClose={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /uri/i }));
    await user.type(
      screen.getByLabelText(/otpauth/i),
      "otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
    );
    await user.click(screen.getByRole("button", { name: /preview|预览|プレビュー/i }));
    await user.click(
      screen.getByRole("button", { name: /confirm import|确认导入|インポートを確定/i }),
    );

    await waitFor(() => {
      expect(tauri.parseOtpauthUri).toHaveBeenCalledTimes(1);
      expect(tauri.commitImport).toHaveBeenCalledTimes(1);
    });
  });
});
