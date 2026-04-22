import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  addAccount,
  deleteAccount,
  getAccounts,
  isVaultInitialized,
  lockVault,
  reorderAccounts,
  setupVault,
  unlockVault,
  updateAccount,
} from "./tauri";

describe("tauri.ts wrappers", () => {
  it("isVaultInitialized calls invoke with correct command", async () => {
    await isVaultInitialized();
    expect(invoke).toHaveBeenCalledWith("is_vault_initialized");
  });

  it("setupVault calls invoke with correct command", async () => {
    await setupVault("mypassword");
    expect(invoke).toHaveBeenCalledWith("setup_vault", { password: "mypassword" });
  });

  it("unlockVault calls invoke with correct command", async () => {
    await unlockVault("pw");
    expect(invoke).toHaveBeenCalledWith("unlock_vault", { password: "pw" });
  });

  it("lockVault calls invoke with correct command", async () => {
    await lockVault();
    expect(invoke).toHaveBeenCalledWith("lock_vault");
  });

  it("getAccounts calls invoke with correct command", async () => {
    await getAccounts();
    expect(invoke).toHaveBeenCalledWith("get_accounts");
  });

  it("addAccount calls invoke with correct command", async () => {
    const input = { name: "test", secret: "JBSWY3DPEHPK3PXP" };
    await addAccount(input);
    expect(invoke).toHaveBeenCalledWith("add_account", { input });
  });

  it("updateAccount calls invoke with correct command", async () => {
    const input = { name: "updated" };
    await updateAccount(1, input);
    expect(invoke).toHaveBeenCalledWith("update_account", { id: 1, input });
  });

  it("deleteAccount calls invoke with correct command", async () => {
    await deleteAccount(42);
    expect(invoke).toHaveBeenCalledWith("delete_account", { id: 42 });
  });

  it("reorderAccounts calls invoke with correct command", async () => {
    await reorderAccounts([3, 1, 2]);
    expect(invoke).toHaveBeenCalledWith("reorder_accounts", { ids: [3, 1, 2] });
  });
});
