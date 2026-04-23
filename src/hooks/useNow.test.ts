import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current unix second on mount", () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(1704067200);
  });

  it("updates after one second passes", async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const { result } = renderHook(() => useNow());

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(1704067201);
  });

  it("does not update within the same second", async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.500Z"));
    const { result } = renderHook(() => useNow());
    const initial = result.current;

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe(initial);
  });
});
