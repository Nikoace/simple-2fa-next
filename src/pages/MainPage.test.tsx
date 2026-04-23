import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));

vi.mock("@/lib/tauri", () => ({
  getAccounts: vi.fn(),
  addAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  reorderAccounts: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { MainPage } from "./MainPage";

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MainPage", () => {
  it("shows loading state", () => {
    vi.mocked(tauri.getAccounts).mockReturnValue(new Promise(() => {}));
    renderWithQuery(<MainPage />);
    expect(screen.getByText(/loading|加载中|読み込み中/i)).toBeTruthy();
  });

  it("shows empty state when no accounts", async () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([]);
    renderWithQuery(<MainPage />);
    await waitFor(() => {
      expect(screen.getByText(/no accounts yet|还没有账户|アカウントがありません/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /add|添加|追加/i })).toBeTruthy();
    });
  });

  it("renders account cards", async () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([
      {
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
      },
    ]);

    renderWithQuery(<MainPage />);

    await waitFor(() => {
      expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
      expect(screen.getByText("123 456")).toBeTruthy();
      expect(screen.getByRole("button", { name: /add|添加|追加/i })).toBeTruthy();
    });
  });
});
