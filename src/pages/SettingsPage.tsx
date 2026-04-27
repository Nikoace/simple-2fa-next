import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { biometricAvailable, disableBiometric, enableBiometric } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings";

export function SettingsPage() {
  const { t } = useTranslation();
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useSettingsStore((s) => s.setBiometricEnabled);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setAvailable(await biometricAvailable());
      } catch {
        setAvailable(false);
      }
    })();
  }, []);

  async function disable() {
    setSubmitting(true);
    setError(null);
    try {
      await disableBiometric();
      setBiometricEnabled(false);
    } catch {
      setError(t("settings.save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function enable() {
    setSubmitting(true);
    setError(null);
    try {
      await enableBiometric(password);
      setBiometricEnabled(true);
      setDialogOpen(false);
      setPassword("");
    } catch {
      setError(t("settings.save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto mt-8 max-w-xl p-6">
      <h2 className="text-xl font-semibold">{t("settings.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("settings.description")}</p>

      <div className="mt-5 flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">{t("settings.biometric_title")}</p>
          <p className="text-sm text-muted-foreground">{t("settings.biometric_desc")}</p>
        </div>
        <Button
          type="button"
          role="switch"
          aria-checked={biometricEnabled}
          onClick={() => {
            if (biometricEnabled) {
              void disable();
            } else {
              setDialogOpen(true);
            }
          }}
          disabled={submitting || available === false}
          variant={biometricEnabled ? "default" : "outline"}
        >
          {biometricEnabled ? t("settings.enabled") : t("settings.disabled")}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 border-t pt-4">
        <p className="text-sm text-muted-foreground">{t("sync.entry_desc")}</p>
        <Link to="/settings/sync" className="mt-2 inline-block">
          <Button type="button" variant="outline">
            {t("sync.entry")}
          </Button>
        </Link>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.enable_biometric_title")}</DialogTitle>
            <DialogDescription>{t("settings.enable_biometric_desc")}</DialogDescription>
          </DialogHeader>

          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("vault.password_placeholder")}
            aria-label={t("vault.password_placeholder")}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {t("accounts.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void enable()}
              disabled={submitting || password.length === 0}
            >
              {t("settings.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
