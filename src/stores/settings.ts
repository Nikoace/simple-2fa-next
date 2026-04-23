import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

type SettingsState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));
