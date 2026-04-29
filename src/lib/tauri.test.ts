import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  addAccount,
  biometricAvailable,
  commitImport,
  configureSync,
  createGroup,
  deleteAccount,
  deleteGroup,
  disableBiometric,
  disableSync,
  enableBiometric,
  exportVaultToFile,
  getAccounts,
  getSyncStatus,
  importS2faFile,
  isVaultInitialized,
  listGroups,
  lockVault,
  parseOtpauthUri,
  renameGroup,
  reorderAccounts,
  setupVault,
  syncNow,
  unlockVault,
  unlockWithBiometric,
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

  it("biometricAvailable calls invoke with correct command", async () => {
    await biometricAvailable();
    expect(invoke).toHaveBeenCalledWith("biometric_available");
  });

  it("enableBiometric calls invoke with correct command", async () => {
    await enableBiometric("pw");
    expect(invoke).toHaveBeenCalledWith("enable_biometric", { password: "pw" });
  });

  it("unlockWithBiometric calls invoke with correct command", async () => {
    await unlockWithBiometric();
    expect(invoke).toHaveBeenCalledWith("unlock_with_biometric");
  });

  it("disableBiometric calls invoke with correct command", async () => {
    await disableBiometric();
    expect(invoke).toHaveBeenCalledWith("disable_biometric");
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

  it("listGroups calls invoke with correct command", async () => {
    await listGroups();
    expect(invoke).toHaveBeenCalledWith("list_groups");
  });

  it("createGroup calls invoke with correct command", async () => {
    await createGroup("Work");
    expect(invoke).toHaveBeenCalledWith("create_group", { name: "Work" });
  });

  it("renameGroup calls invoke with correct command", async () => {
    await renameGroup(5, "Personal");
    expect(invoke).toHaveBeenCalledWith("rename_group", { id: 5, name: "Personal" });
  });

  it("deleteGroup calls invoke with correct command", async () => {
    await deleteGroup(3);
    expect(invoke).toHaveBeenCalledWith("delete_group", { id: 3 });
  });

  it("importS2faFile calls invoke with correct command", async () => {
    await importS2faFile("/tmp/backup.s2fa", "secret");
    expect(invoke).toHaveBeenCalledWith("import_s2fa_file", {
      path: "/tmp/backup.s2fa",
      password: "secret",
    });
  });

  it("commitImport calls invoke with correct command", async () => {
    const items = [{ name: "Test", secret: "ABC", algorithm: "SHA1", digits: 6, period: 30 }];
    await commitImport(items);
    expect(invoke).toHaveBeenCalledWith("commit_import", { items });
  });

  it("parseOtpauthUri calls invoke with correct command", async () => {
    const uri = "otpauth://totp/Test?secret=ABC";
    await parseOtpauthUri(uri);
    expect(invoke).toHaveBeenCalledWith("parse_otpauth_uri_cmd", { uri });
  });

  it("exportVaultToFile calls invoke with correct command", async () => {
    await exportVaultToFile("/tmp/export.s2fa", "mypassword");
    expect(invoke).toHaveBeenCalledWith("export_vault_to_file", {
      path: "/tmp/export.s2fa",
      password: "mypassword",
    });
  });

  it("configureSync calls invoke with correct command", async () => {
    const config = {
      type: "WebDav" as const,
      url: "https://dav.example.com",
      username: "user",
      password: "pw",
      remotePath: "/2fa",
    };
    await configureSync(config);
    expect(invoke).toHaveBeenCalledWith("configure_sync", { config });
  });

  it("syncNow calls invoke with correct command", async () => {
    await syncNow();
    expect(invoke).toHaveBeenCalledWith("sync_now");
  });

  it("getSyncStatus calls invoke with correct command", async () => {
    await getSyncStatus();
    expect(invoke).toHaveBeenCalledWith("get_sync_status");
  });

  it("disableSync calls invoke with correct command", async () => {
    await disableSync();
    expect(invoke).toHaveBeenCalledWith("disable_sync");
  });
});
