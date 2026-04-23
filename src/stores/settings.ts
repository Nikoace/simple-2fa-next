import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type SettingsState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
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
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    { name: "s2fa-settings" },
  ),
);

// Prevent FOUC: apply persisted theme synchronously before first React render
applyTheme(useSettingsStore.getState().theme);
