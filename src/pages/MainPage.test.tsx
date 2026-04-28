import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));

vi.mock("@/lib/tauri", () => ({
  getAccounts: vi.fn(),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
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
  it("filters accounts by selected group", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([
      { id: 1, name: "Work", sortOrder: 0 },
      { id: 2, name: "Personal", sortOrder: 1 },
    ]);
    vi.mocked(tauri.getAccounts).mockResolvedValue([
      {
        id: 1,
        name: "GitHub",
        issuer: "GitHub",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        groupId: 1,
        icon: null,
        color: null,
        sortOrder: 0,
        code: "123456",
        ttl: 15,
        progress: 0.5,
      },
      {
        id: 2,
        name: "Google",
        issuer: "Google",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        groupId: 2,
        icon: null,
        color: null,
        sortOrder: 1,
        code: "654321",
        ttl: 20,
        progress: 0.67,
      },
    ]);

    renderWithQuery(<MainPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Work" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Personal" })).toBeTruthy();
    });

    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Google").length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Work" }));

    await waitFor(() => {
      expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
      expect(screen.queryByText("Google")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /all|全部|すべて/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Google").length).toBeGreaterThan(0);
    });
  });

  it("shows loading state", () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([]);
    vi.mocked(tauri.getAccounts).mockReturnValue(new Promise(() => {}));
    renderWithQuery(<MainPage />);
    expect(screen.getByText(/loading|加载中|読み込み中/i)).toBeTruthy();
  });

  it("shows empty state when no accounts", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([]);
    vi.mocked(tauri.getAccounts).mockResolvedValue([]);
    renderWithQuery(<MainPage />);
    await waitFor(() => {
      expect(screen.getByText(/no accounts yet|还没有账户|アカウントがありません/i)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /add account|添加账户|アカウントを追加/i }),
      ).toBeTruthy();
    });
  });

  it("shows error state", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([]);
    vi.mocked(tauri.getAccounts).mockRejectedValue(new Error("network error"));
    renderWithQuery(<MainPage />);
    await waitFor(() => {
      expect(screen.getByText(/something went wrong|出错了/i)).toBeTruthy();
    });
  });

  it("shows empty group message when filtered accounts is empty", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([
      { id: 1, name: "Work", sortOrder: 0 },
      { id: 2, name: "Personal", sortOrder: 1 },
    ]);
    vi.mocked(tauri.getAccounts).mockResolvedValue([
      {
        id: 1,
        name: "GitHub",
        issuer: "GitHub",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        groupId: 1,
        icon: null,
        color: null,
        sortOrder: 0,
        code: "123456",
        ttl: 15,
        progress: 0.5,
      },
    ]);

    const user = userEvent.setup();
    renderWithQuery(<MainPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Personal" })).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Personal" }));

    await waitFor(() => {
      expect(screen.getByText(/no accounts in this group|该分组下暂无账户/i)).toBeTruthy();
    });
  });

  it("renders account cards", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([]);
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
      expect(
        screen.getByRole("button", { name: /add account|添加账户|アカウントを追加/i }),
      ).toBeTruthy();
    });
  });
});
