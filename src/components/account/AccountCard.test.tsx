import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useNow", () => ({ useNow: vi.fn() }));

import { useNow } from "@/hooks/useNow";
import type { AccountWithCode } from "@/lib/tauri";
import { AccountCard } from "./AccountCard";

const account: AccountWithCode = {
  id: 1,
  name: "alice@example.com",
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
};

beforeEach(() => {
  vi.mocked(useNow).mockReturnValue(1704067215); // 1704067215 % 30 = 15, ttl = 15
});

describe("AccountCard", () => {
  it("shows account name", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("alice@example.com")).toBeTruthy();
  });

  it("shows issuer", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("shows formatted code '123 456'", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("123 456")).toBeTruthy();
  });

  it("copies code to clipboard on click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<AccountCard account={account} />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("123456");
  });

  it("renders danger state when ttl <= 5s", () => {
    // 1704067225 % 30 = 25, ttl = 30 - 25 = 5, triggers danger
    vi.mocked(useNow).mockReturnValue(1704067225);
    const { container } = render(<AccountCard account={account} />);
    expect(container.querySelector(".countdown-ring--danger")).toBeTruthy();
  });
});
