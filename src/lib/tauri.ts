import { invoke } from "@tauri-apps/api/core";

export type AccountWithCode = {
  id: number;
  groupId: number | null;
  name: string;
  issuer: string | null;
  algorithm: "SHA1" | "SHA256" | "SHA512";
  digits: 6 | 7 | 8;
  period: number;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  code: string;
  ttl: number;
  progress: number;
};

export type Account = Omit<AccountWithCode, "code" | "ttl" | "progress">;

export type Group = {
  id: number;
  name: string;
  sortOrder: number;
};

export type AddAccountInput = {
  name: string;
  issuer?: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  icon?: string;
  color?: string;
  groupId?: number;
};

export type UpdateAccountInput = {
  name?: string;
  issuer?: string;
  icon?: string;
  color?: string;
  groupId?: number | null;
  notes?: string;
};

export type ImportAccountItem = {
  name: string;
  issuer?: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
};

export type ImportPreview = {
  items: ImportAccountItem[];
  sourceVersion: number;
};

export type SyncConfig =
  | {
      type: "WebDav";
      url: string;
      username: string;
      password: string;
      remotePath: string;
    }
  | {
      type: "S3";
      bucket: string;
      prefix: string;
      region: string;
      accessKey: string;
      secretKey: string;
    };

export type SyncStatus = {
  lastSync: string | null;
  lastError: string | null;
  inProgress: boolean;
};

export const isVaultInitialized = () => invoke<boolean>("is_vault_initialized");

export const setupVault = (password: string) => invoke<void>("setup_vault", { password });

export const unlockVault = (password: string) => invoke<void>("unlock_vault", { password });

export const biometricAvailable = () => invoke<boolean>("biometric_available");

export const enableBiometric = (password: string) => invoke<void>("enable_biometric", { password });

export const unlockWithBiometric = () => invoke<void>("unlock_with_biometric");

export const disableBiometric = () => invoke<void>("disable_biometric");

export const lockVault = () => invoke<void>("lock_vault");

export const getAccounts = () => invoke<AccountWithCode[]>("get_accounts");

export const addAccount = (input: AddAccountInput) =>
  invoke<AccountWithCode>("add_account", { input });

export const updateAccount = (id: number, input: UpdateAccountInput) =>
  invoke<AccountWithCode>("update_account", { id, input });

export const deleteAccount = (id: number) => invoke<void>("delete_account", { id });

export const reorderAccounts = (ids: number[]) => invoke<void>("reorder_accounts", { ids });

export const listGroups = () => invoke<Group[]>("list_groups");

export const createGroup = (name: string) => invoke<Group>("create_group", { name });

export const renameGroup = (id: number, name: string) =>
  invoke<Group>("rename_group", { id, name });

export const deleteGroup = (id: number) => invoke<void>("delete_group", { id });

export const importS2faFile = (path: string, password: string) =>
  invoke<ImportPreview>("import_s2fa_file", { path, password });

export const commitImport = (items: ImportAccountItem[]) =>
  invoke<AccountWithCode[]>("commit_import", { items });

export const parseOtpauthUri = (uri: string) =>
  invoke<ImportAccountItem>("parse_otpauth_uri_cmd", { uri });

export const exportVaultToFile = (path: string, password: string) =>
  invoke<void>("export_vault_to_file", { path, password });

export const configureSync = (config: SyncConfig) => invoke<void>("configure_sync", { config });

export const syncNow = () => invoke<SyncStatus>("sync_now");

export const getSyncStatus = () => invoke<SyncStatus>("get_sync_status");

export const disableSync = () => invoke<void>("disable_sync");
