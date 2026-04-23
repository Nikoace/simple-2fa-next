import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountWithCode } from "@/lib/tauri";
import { updateAccount } from "@/lib/tauri";

const schema = z.object({
  name: z.string().min(1, "name_required"),
  issuer: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  account: AccountWithCode;
  onClose: () => void;
};

export function EditAccountDialog({ open, account, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: account.name,
      issuer: account.issuer ?? "",
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: form.reset is stable across renders
  useEffect(() => {
    form.reset({ name: account.name, issuer: account.issuer ?? "" });
  }, [account]);

  function messageFor(errorMessage: unknown) {
    if (typeof errorMessage !== "string") {
      return "";
    }
    return t(`accounts.${errorMessage}`);
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await updateAccount(account.id, {
        name: values.name,
        issuer: values.issuer?.trim() || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounts.edit")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t("accounts.name_label")}</Label>
            <Input
              id="edit-name"
              aria-label={t("accounts.name_label")}
              placeholder={t("accounts.name_placeholder")}
              {...form.register("name")}
            />
            {form.formState.errors.name?.message && (
              <p className="text-sm text-destructive">
                {messageFor(form.formState.errors.name.message)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-issuer">{t("accounts.issuer_label")}</Label>
            <Input
              id="edit-issuer"
              aria-label={t("accounts.issuer_label")}
              placeholder={t("accounts.issuer_placeholder")}
              {...form.register("issuer")}
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("accounts.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
              {t("accounts.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
