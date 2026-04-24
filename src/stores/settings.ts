import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

export type SettingsState = {
  theme: ThemeMode;
  biometricEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setBiometricEnabled: (enabled: boolean) => void;
};

export function applyTheme(theme: ThemeMode) {
  const prefersDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      biometricEnabled: false,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setBiometricEnabled: (enabled) => {
        set({ biometricEnabled: enabled });
      },
    }),
    { name: "s2fa-settings" },
  ),
);

// Prevent FOUC: apply persisted theme synchronously before first React render
applyTheme(useSettingsStore.getState().theme);
