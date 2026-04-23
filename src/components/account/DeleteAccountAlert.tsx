import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AccountWithCode } from "@/lib/tauri";
import { deleteAccount } from "@/lib/tauri";

type Props = {
  open: boolean;
  account: AccountWithCode;
  onClose: () => void;
};

export function DeleteAccountAlert({ open, account, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onConfirm() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteAccount(account.id);
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("accounts.delete_confirm_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("accounts.delete_confirm_desc", { name: account.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="ghost" disabled={isDeleting}>
              {t("accounts.cancel")}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" disabled={isDeleting} onClick={() => void onConfirm()}>
              {t("accounts.delete")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
