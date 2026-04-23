import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({ updateAccount: vi.fn() }));

import type { AccountWithCode } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";
import { EditAccountDialog } from "./EditAccountDialog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const account: AccountWithCode = {
  id: 1,
  name: "GitHub",
  issuer: "GitHub Inc",
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
};
const onClose = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe("EditAccountDialog", () => {
  it("pre-fills name and issuer fields", () => {
    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    expect((screen.getByLabelText(/name|名称/i) as HTMLInputElement).value).toBe("GitHub");
    expect((screen.getByLabelText(/issuer|服务/i) as HTMLInputElement).value).toBe("GitHub Inc");
  });

  it("calls updateAccount on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.updateAccount).mockResolvedValue({ ...account, name: "GL" });

    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    const nameInput = screen.getByLabelText(/name|名称/i);
    await user.clear(nameInput);
    await user.type(nameInput, "GL");
    await user.click(screen.getByRole("button", { name: /save|保存/i }));

    await waitFor(() =>
      expect(tauri.updateAccount).toHaveBeenCalledWith(1, expect.objectContaining({ name: "GL" })),
    );
  });

  it("calls onClose after successful submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.updateAccount).mockResolvedValue(account);
    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    await user.click(screen.getByRole("button", { name: /save|保存/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
