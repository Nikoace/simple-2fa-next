import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ScanConfirmDialog } from "@/components/account/ScanConfirmDialog";

const ITEM = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
};

describe("ScanConfirmDialog", () => {
  it("renders nothing when item is null", () => {
    const { container } = render(
      <ScanConfirmDialog item={null} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows issuer and name when item is provided", () => {
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("calls onConfirm with item when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /添加|Add|追加/i }));
    expect(onConfirm).toHaveBeenCalledWith(ITEM);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /取消|Cancel|キャンセル/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
