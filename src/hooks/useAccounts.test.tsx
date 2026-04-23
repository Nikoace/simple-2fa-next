import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  getAccounts: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { useAccounts } from "./useAccounts";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useAccounts", () => {
  it("returns accounts on success", async () => {
    const mockAccount = {
      id: 1,
      name: "GitHub",
      issuer: "GitHub",
      algorithm: "SHA1" as const,
      digits: 6 as const,
      period: 30,
      groupId: null,
      icon: null,
      color: null,
      sortOrder: 0,
      code: "123456",
      ttl: 15,
      progress: 0.5,
    };
    vi.mocked(tauri.getAccounts).mockResolvedValue([mockAccount]);

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("GitHub");
  });

  it("returns error state on failure", async () => {
    vi.mocked(tauri.getAccounts).mockRejectedValue(new Error("vault locked"));

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("query key is ['accounts']", () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([]);
    const { result } = renderHook(() => useAccounts(), { wrapper });
    expect(result.current.queryKey).toEqual(["accounts"]);
  });
});
