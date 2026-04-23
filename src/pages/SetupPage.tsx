import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setupVault, unlockVault } from "@/lib/tauri";

export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await setupVault(password);
      await unlockVault(password);
      await navigate({ to: "/" });
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-md p-6">
      <h2 className="text-xl font-semibold">{t("vault.setup_title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("vault.setup_subtitle")}</p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("vault.password_placeholder")}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || password.length < 8}>
          {loading ? t("common.loading") : t("vault.setup_submit")}
        </Button>
      </form>
    </Card>
  );
}
