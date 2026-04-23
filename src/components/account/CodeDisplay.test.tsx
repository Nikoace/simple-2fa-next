import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { CodeDisplay } from "./CodeDisplay";

describe("CodeDisplay", () => {
  it("formats 6-digit code as 'xxx xxx'", () => {
    render(<CodeDisplay code="123456" digits={6} />);
    expect(screen.getByText("123 456")).toBeTruthy();
  });

  it("formats 8-digit code as 'xxxx xxxx'", () => {
    render(<CodeDisplay code="12345678" digits={8} />);
    expect(screen.getByText("1234 5678")).toBeTruthy();
  });

  it("applies monospace font class", () => {
    const { container } = render(<CodeDisplay code="123456" digits={6} />);
    const el = container.querySelector("span");
    expect(el?.className).toContain("font-mono");
  });

  it("renders the raw code when length does not match digits", () => {
    render(<CodeDisplay code="123456" digits={7} />);
    expect(screen.getByText("123456")).toBeTruthy();
  });
});
