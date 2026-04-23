import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportVaultToFile } from "@/lib/tauri";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ExportDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (password !== confirmPassword) {
      setError(t("export.password_mismatch"));
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const targetPath = await save({
        filters: [{ name: "s2fa", extensions: ["s2fa"] }],
      });
      if (!targetPath) {
        return;
      }
      await exportVaultToFile(targetPath, password);
      setMessage(t("export.success"));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetState() {
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setError("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetState();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("export.password")}</Label>
            <Input
              aria-label={t("export.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("export.confirm_password")}</Label>
            <Input
              aria-label={t("export.confirm_password")}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetState();
                onClose();
              }}
            >
              {t("accounts.cancel")}
            </Button>
            <Button type="button" onClick={() => void onExport()} disabled={busy || !password}>
              {t("export.submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
