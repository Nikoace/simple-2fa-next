import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  deleteAccount: vi.fn(),
}));

import type { AccountWithCode } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";
import { DeleteAccountAlert } from "./DeleteAccountAlert";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const account: AccountWithCode = {
  id: 9,
  name: "GitLab",
  issuer: "GitLab",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  groupId: null,
  icon: null,
  color: null,
  sortOrder: 0,
  code: "654321",
  ttl: 10,
  progress: 0.33,
};

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteAccountAlert", () => {
  it("confirm calls deleteAccount and onClose", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.deleteAccount).mockResolvedValue(undefined);

    render(<DeleteAccountAlert open account={account} onClose={onClose} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /delete|删除|削除/i }));

    await waitFor(() => expect(tauri.deleteAccount).toHaveBeenCalledWith(9));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("cancel does not call deleteAccount", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountAlert open account={account} onClose={onClose} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /cancel|取消|キャンセル/i }));

    expect(tauri.deleteAccount).not.toHaveBeenCalled();
  });

  it("handles deleteAccount error without crashing", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.deleteAccount).mockRejectedValue(new Error("not found"));

    render(<DeleteAccountAlert open account={account} onClose={onClose} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /delete|删除|削除/i }));

    await waitFor(() => {
      expect(tauri.deleteAccount).toHaveBeenCalledWith(9);
    });
    // allow async error path (catch block) to complete
    await new Promise((r) => setTimeout(r, 50));
  });
});
