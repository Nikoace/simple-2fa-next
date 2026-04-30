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
};

export function ScanConfirmDialog({ item, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
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

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("accounts.cancel")}
          </Button>
          <Button type="button" onClick={() => onConfirm(item)}>
            {t("scan.confirm_add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
