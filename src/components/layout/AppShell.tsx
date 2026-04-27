import { Outlet, useNavigate } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { Moon, RefreshCw, Settings, Sun, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ExportDialog } from "@/components/import/ExportDialog";
import { ImportDialog } from "@/components/import/ImportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSyncStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { applyTheme, useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

const LANG_LABELS: Record<string, string> = {
  "zh-CN": "中文",
  en: "EN",
  ja: "日本語",
};

export function AppShell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { theme, setTheme } = useSettingsStore();
  const lock = useVaultStore((state) => state.lock);
  const vaultStatus = useVaultStore((s) => s.status);
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: string | null;
    lastError: string | null;
    inProgress: boolean;
  }>({
    lastSync: null,
    lastError: null,
    inProgress: false,
  });

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") {
      return;
    }

    void (async () => {
      try {
        setSyncStatus(await getSyncStatus());
      } catch {
        // Ignore when sync backend is not configured yet.
      }
    })();

    let mounted = true;
    const stop = listen<{
      lastSync: string | null;
      lastError: string | null;
      inProgress: boolean;
    }>("sync://status-changed", (event) => {
      if (mounted) {
        setSyncStatus(event.payload);
      }
    });

    return () => {
      mounted = false;
      void stop.then((fn) => fn());
    };
  }, [vaultStatus]);

  let badgeIcon = <RefreshCw className="size-3" />;
  if (syncStatus.inProgress) {
    badgeIcon = <RefreshCw className="size-3 animate-spin" />;
  } else if (syncStatus.lastError) {
    badgeIcon = <TriangleAlert className="size-3 text-destructive" />;
  }

  let badgeText = t("sync.badge_idle");
  if (syncStatus.inProgress) {
    badgeText = t("sync.badge_syncing");
  } else if (syncStatus.lastError) {
    badgeText = t("sync.badge_error");
  } else if (syncStatus.lastSync) {
    badgeText = t("sync.badge_last_sync", {
      time: new Date(syncStatus.lastSync).toLocaleTimeString(),
    });
  }

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
                {LANG_LABELS[i18n.language] ?? i18n.language}
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

          {vaultStatus === "unlocked" && (
            <>
              <div className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                {badgeIcon}
                <span>{badgeText}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-muted-foreground hover:text-foreground")}
                onClick={() => setImportOpen(true)}
              >
                {t("nav.import")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-muted-foreground hover:text-foreground")}
                onClick={() => setExportOpen(true)}
              >
                {t("nav.export")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("nav.settings")}
                className={cn("text-muted-foreground hover:text-foreground")}
                onClick={() => {
                  void navigate({ to: "/settings" });
                }}
              >
                <Settings className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-muted-foreground hover:text-foreground")}
                onClick={async () => {
                  await lock();
                }}
              >
                {t("nav.lock")}
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
        <Outlet />
      </main>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
