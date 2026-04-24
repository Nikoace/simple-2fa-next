import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  listGroups: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { useGroups } from "./useGroups";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useGroups", () => {
  it("returns groups on success", async () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([
      {
        id: 1,
        name: "Work",
        sortOrder: 0,
      },
    ]);

    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Work");
  });

  it("returns error state on failure", async () => {
    vi.mocked(tauri.listGroups).mockRejectedValue(new Error("db error"));

    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("query key is ['groups']", () => {
    vi.mocked(tauri.listGroups).mockResolvedValue([]);

    const { result } = renderHook(() => useGroups(), { wrapper });

    expect(result.current.queryKey).toEqual(["groups"]);
  });
});
