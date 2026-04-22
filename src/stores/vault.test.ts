import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  isVaultInitialized: vi.fn(),
  setupVault: vi.fn(),
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
}));

import * as tauriLib from "@/lib/tauri";
import { useVaultStore } from "./vault";

beforeEach(() => {
  act(() => {
    useVaultStore.setState({ status: "loading", error: null });
  });
  vi.clearAllMocks();
});

describe("useVaultStore", () => {
  it("checkStatus: sets uninitialized when vault not set up", async () => {
    vi.mocked(tauriLib.isVaultInitialized).mockResolvedValue(false);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.checkStatus());
    expect(result.current.status).toBe("uninitialized");
  });

  it("checkStatus: sets locked when vault exists", async () => {
    vi.mocked(tauriLib.isVaultInitialized).mockResolvedValue(true);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.checkStatus());
    expect(result.current.status).toBe("locked");
  });

  it("unlock: sets unlocked on success", async () => {
    vi.mocked(tauriLib.unlockVault).mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.unlock("password"));
    expect(result.current.status).toBe("unlocked");
  });

  it("unlock: sets error status on failure", async () => {
    vi.mocked(tauriLib.unlockVault).mockRejectedValue("wrong password");
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.unlock("wrong"));
    expect(result.current.error).toBeTruthy();
    expect(result.current.status).toBe("error");
  });

  it("checkStatus: sets error status on failure", async () => {
    vi.mocked(tauriLib.isVaultInitialized).mockRejectedValue(new Error("ipc error"));
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.checkStatus());
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("setup: sets error status on failure", async () => {
    vi.mocked(tauriLib.setupVault).mockRejectedValue(new Error("already initialized"));
    const { result } = renderHook(() => useVaultStore());
    await act(() => result.current.setup("pw"));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("lock: sets locked", async () => {
    vi.mocked(tauriLib.lockVault).mockResolvedValue(undefined);
    const { result } = renderHook(() => useVaultStore());
    act(() => {
      useVaultStore.setState({ status: "unlocked" });
    });
    await act(() => result.current.lock());
    expect(result.current.status).toBe("locked");
  });
});
