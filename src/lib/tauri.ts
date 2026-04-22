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
  groupId?: number;
  notes?: string;
};

export const isVaultInitialized = () => invoke<boolean>("is_vault_initialized");

export const setupVault = (password: string) => invoke<void>("setup_vault", { password });

export const unlockVault = (password: string) => invoke<void>("unlock_vault", { password });

export const lockVault = () => invoke<void>("lock_vault");

export const getAccounts = () => invoke<AccountWithCode[]>("get_accounts");

export const addAccount = (input: AddAccountInput) =>
  invoke<AccountWithCode>("add_account", { input });

export const updateAccount = (id: number, input: UpdateAccountInput) =>
  invoke<AccountWithCode>("update_account", { id, input });

export const deleteAccount = (id: number) => invoke<void>("delete_account", { id });

export const reorderAccounts = (ids: number[]) => invoke<void>("reorder_accounts", { ids });
