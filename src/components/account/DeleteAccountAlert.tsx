import { useQueryClient } from "@tanstack/react-query";
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

  async function onConfirm() {
    await deleteAccount(account.id);
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    onClose();
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

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="ghost">
              {t("accounts.cancel")}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" onClick={() => void onConfirm()}>
              {t("accounts.delete")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
