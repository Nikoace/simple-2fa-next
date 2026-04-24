import { create } from "zustand";

import {
  isVaultInitialized,
  lockVault,
  setupVault,
  unlockVault,
  unlockWithBiometric,
} from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings";

type VaultStatus = "loading" | "uninitialized" | "locked" | "unlocked" | "error";

type VaultStore = {
  status: VaultStatus;
  error: string | null;
  checkStatus: () => Promise<void>;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  unlockByBiometric: () => Promise<void>;
  lock: () => Promise<void>;
};

export const useVaultStore = create<VaultStore>((set) => ({
  status: "loading",
  error: null,

  checkStatus: async () => {
    try {
      const initialized = await isVaultInitialized();
      set({ status: initialized ? "locked" : "uninitialized", error: null });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  setup: async (password) => {
    try {
      await setupVault(password);
      set({ status: "unlocked", error: null });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  unlock: async (password) => {
    try {
      await unlockVault(password);
      set({ status: "unlocked", error: null });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  unlockByBiometric: async () => {
    try {
      await unlockWithBiometric();
      set({ status: "unlocked", error: null });
    } catch (e) {
      const err = e as { kind?: string } | null;
      if (err?.kind === "BiometricNotEnabled") {
        useSettingsStore.getState().setBiometricEnabled(false);
      }
      set({ status: "error", error: String(e) });
    }
  },

  lock: async () => {
    await lockVault();
    set({ status: "locked", error: null });
  },
}));
