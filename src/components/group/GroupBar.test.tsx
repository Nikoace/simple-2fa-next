import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { GroupBar } from "./GroupBar";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const groups = [
  { id: 1, name: "Work", sortOrder: 0 },
  { id: 2, name: "Personal", sortOrder: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, "prompt").mockReturnValue(null);
  vi.spyOn(globalThis, "confirm").mockReturnValue(true);
});

describe("GroupBar", () => {
  it("renders all tab and group tabs", () => {
    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    expect(screen.getByRole("button", { name: /all|全部/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personal" })).toBeTruthy();
  });

  it("calls onSelect with group id when clicking a group", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={onSelect} />, { wrapper });

    await user.click(screen.getByRole("button", { name: "Work" }));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onSelect(null) when clicking all", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<GroupBar groups={groups} selectedGroupId={1} onSelect={onSelect} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /all|全部/i }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("creates group on Enter from inline input", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.createGroup).mockResolvedValue({ id: 3, name: "School", sortOrder: 2 });

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /add group|添加分组|グループ追加/i }));
    const input = screen.getByLabelText(/group name|分组名称|グループ名/i);
    await user.type(input, "School{Enter}");

    await waitFor(() => expect(tauri.createGroup).toHaveBeenCalledWith("School"));
  });

  it("deletes group when confirm returns true", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    vi.mocked(tauri.deleteGroup).mockResolvedValue(undefined);

    render(
      <GroupBar
        groups={[{ id: 1, name: "Work", sortOrder: 0 }]}
        selectedGroupId={null}
        onSelect={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByLabelText(/group actions|actions|操作/i)[0]);
    await user.click(screen.getByText(/delete|删除/i));

    await waitFor(() => expect(tauri.deleteGroup).toHaveBeenCalledWith(1));
  });

  it("does not delete group when confirm returns false", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    vi.mocked(tauri.deleteGroup).mockResolvedValue(undefined);

    render(
      <GroupBar
        groups={[{ id: 1, name: "Work", sortOrder: 0 }]}
        selectedGroupId={null}
        onSelect={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByLabelText(/group actions|actions|操作/i)[0]);
    await user.click(screen.getByText(/delete|删除/i));

    await waitFor(() => expect(tauri.deleteGroup).not.toHaveBeenCalled());
  });

  it("calls onSelect(null) when deleting the currently selected group", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    vi.mocked(tauri.deleteGroup).mockResolvedValue(undefined);

    render(
      <GroupBar
        groups={[{ id: 1, name: "Work", sortOrder: 0 }]}
        selectedGroupId={1}
        onSelect={onSelect}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByLabelText(/group actions|actions|操作/i)[0]);
    await user.click(screen.getByText(/delete|删除/i));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it("closes input on Escape key", async () => {
    const user = userEvent.setup();

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /add group|添加分组|グループ追加/i }));
    const input = screen.getByLabelText(/group name|分组名称|グループ名/i);
    await user.type(input, "Test");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByLabelText(/group name|分组名称|グループ名/i)).toBeNull(),
    );
  });

  it("calls renameGroup when prompt returns a new name", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "prompt").mockReturnValue("New Work");
    vi.mocked(tauri.renameGroup).mockResolvedValue({ id: 1, name: "New Work", sortOrder: 0 });

    render(
      <GroupBar
        groups={[{ id: 1, name: "Work", sortOrder: 0 }]}
        selectedGroupId={null}
        onSelect={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByLabelText(/group actions|actions|操作/i)[0]);
    await user.click(screen.getByText(/rename|重命名/i));

    await waitFor(() => expect(tauri.renameGroup).toHaveBeenCalledWith(1, "New Work"));
  });
});
