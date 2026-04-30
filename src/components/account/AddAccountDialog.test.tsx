import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  addAccount: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { AddAccountDialog } from "./AddAccountDialog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddAccountDialog", () => {
  it("renders when open=true", () => {
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("submit button is disabled when required fields are empty", () => {
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    expect(screen.getByRole("button", { name: /add|添加|追加/i })).toBeDisabled();
  });

  it("calls addAccount with correct payload on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.addAccount).mockResolvedValue({
      id: 1,
      name: "GitHub",
      issuer: "GitHub",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      groupId: null,
      icon: null,
      color: null,
      sortOrder: 0,
      code: "123456",
      ttl: 15,
      progress: 0.5,
    });

    render(<AddAccountDialog open onClose={onClose} />, { wrapper });

    await user.type(screen.getByLabelText(/name|名称/i), "GitHub");
    await user.type(screen.getByLabelText(/secret|密钥/i), "JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() =>
      expect(tauri.addAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" }),
      ),
    );
  });

  it("shows validation error when secret is not Base32", async () => {
    const user = userEvent.setup();
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });

    await user.type(screen.getByLabelText(/name|名称/i), "Test");
    await user.type(screen.getByLabelText(/secret|密钥/i), "not-base32!!");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() => {
      expect(screen.getByText(/must be a valid base32|有效的 Base32/i)).toBeTruthy();
    });
    expect(tauri.addAccount).not.toHaveBeenCalled();
  });

  it("shows error message when addAccount throws", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.addAccount).mockRejectedValue(new Error("duplicate secret"));

    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    await user.type(screen.getByLabelText(/name|账户名称/i), "GitHub");
    await user.type(screen.getByLabelText(/secret|密钥/i), "JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: /add account|添加账户/i }));

    await waitFor(() => {
      expect(screen.getByText(/duplicate secret/i)).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the scan screen button", () => {
    render(<AddAccountDialog open onClose={vi.fn()} />, { wrapper });
    expect(
      screen.getByRole("button", { name: /扫描屏幕|Scan Screen|画面をスキャン/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose after successful submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.addAccount).mockResolvedValue({
      id: 1,
      name: "X",
      issuer: null,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      groupId: null,
      icon: null,
      color: null,
      sortOrder: 0,
      code: "000000",
      ttl: 30,
      progress: 1,
    });

    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    await user.type(screen.getByLabelText(/name|名称/i), "X");
    await user.type(screen.getByLabelText(/secret|密钥/i), "JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
