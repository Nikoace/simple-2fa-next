import { Outlet } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

function useApplyTheme(theme: "light" | "dark" | "system") {
  useEffect(() => {
    const root = document.documentElement;
    const darkPreferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && darkPreferred);
    root.classList.toggle("dark", isDark);
  }, [theme]);
}

export function AppShell() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useSettingsStore();
  const lock = useVaultStore((state) => state.lock);

  useApplyTheme(theme);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Simple 2FA
        </h1>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <span className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted">
                {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                {t("theme.light")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                {t("theme.dark")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                {t("theme.system")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <span className="inline-flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                {i18n.language}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => void i18n.changeLanguage("zh-CN")}>
                简体中文
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void i18n.changeLanguage("en")}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void i18n.changeLanguage("ja")}>
                日本語
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className={cn("text-muted-foreground hover:text-foreground")}
            onClick={() => void lock()}
          >
            {t("nav.lock")}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
        <Outlet />
      </main>
    </div>
  );
}
