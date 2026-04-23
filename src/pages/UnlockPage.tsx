import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { unlockVault } from "@/lib/tauri";

export function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWrong(false);
    setLoading(true);
    try {
      await unlockVault(password);
      await navigate({ to: "/" });
    } catch {
      setWrong(true);
    } finally {
      setLoading(false);
    }
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
        {wrong && <p className="text-sm text-destructive">{t("vault.wrong_password")}</p>}
        <Button type="submit" className="w-full" disabled={loading || password.length === 0}>
          {loading ? t("common.loading") : t("vault.unlock_submit")}
        </Button>
      </form>
    </Card>
  );
}
