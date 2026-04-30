import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportAccountItem } from "@/lib/tauri";

type Props = {
  item: ImportAccountItem | null;
  onConfirm: (item: ImportAccountItem) => void;
  onCancel: () => void;
  error?: string | null;
  isSubmitting?: boolean;
};

export function ScanConfirmDialog({
  item,
  onConfirm,
  onCancel,
  error,
  isSubmitting = false,
}: Props) {
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("scan.confirm_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {item.issuer && (
            <p>
              <span className="font-medium">{t("accounts.issuer_label")}: </span>
              {item.issuer}
            </p>
          )}
          <p>
            <span className="font-medium">{t("accounts.name_label")}: </span>
            {item.name}
          </p>
          <p>
            <span className="font-medium">{t("accounts.algorithm_label")}: </span>
            {item.algorithm}
          </p>
          <p>
            <span className="font-medium">{t("accounts.digits_label")}: </span>
            {item.digits}
          </p>
          <p>
            <span className="font-medium">{t("accounts.period_label")}: </span>
            {item.period}s
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
            {t("accounts.cancel")}
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => onConfirm(item)}>
            {t("scan.confirm_add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
