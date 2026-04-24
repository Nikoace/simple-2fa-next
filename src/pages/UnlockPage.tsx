import { useNavigate } from "@tanstack/react-router";
import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { biometricAvailable } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

export function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unlock, unlockByBiometric, status, error } = useVaultStore();
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);

  useEffect(() => {
    if (status === "unlocked") void navigate({ to: "/" });
  }, [status, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const available = await biometricAvailable();
        if (active) {
          setBiometricReady(available);
        }
      } catch {
        if (active) {
          setBiometricReady(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    await unlock(password);
    setLoading(false);
  }

  async function onBiometricUnlock() {
    setLoading(true);
    await unlockByBiometric();
    setLoading(false);
  }

  return (
    <Card className="mx-auto mt-10 max-w-md p-6">
      <h2 className="text-xl font-semibold">{t("vault.unlock_title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("vault.unlock_subtitle")}</p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("vault.password_placeholder")}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || password.length === 0}>
          {loading ? t("common.loading") : t("vault.unlock_submit")}
        </Button>
        {biometricReady && biometricEnabled && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void onBiometricUnlock()}
            disabled={loading}
          >
            <Fingerprint className="mr-2 size-4" />
            {t("vault.unlock_with_biometric")}
          </Button>
        )}
      </form>
    </Card>
  );
}
