import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGroups } from "@/hooks/useGroups";
import type { AccountWithCode } from "@/lib/tauri";
import { updateAccount } from "@/lib/tauri";

const NO_GROUP_VALUE = "__none__";

const schema = z.object({
  name: z.string().min(1, "name_required"),
  issuer: z.string().optional(),
  groupId: z.number().nullable(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  account: AccountWithCode;
  onClose: () => void;
};

export function EditAccountDialog({ open, account, onClose }: Readonly<Props>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: groups = [] } = useGroups();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: account.name,
      issuer: account.issuer ?? "",
      groupId: account.groupId,
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: form.reset is stable across renders
  useEffect(() => {
    form.reset({ name: account.name, issuer: account.issuer ?? "", groupId: account.groupId });
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
        groupId: values.groupId ?? null,
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

          <div className="space-y-2">
            <Label htmlFor="edit-group">{t("groups.select_label")}</Label>
            <Controller
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <Select
                  value={field.value === null ? NO_GROUP_VALUE : String(field.value)}
                  onValueChange={(v) => field.onChange(v === NO_GROUP_VALUE ? null : Number(v))}
                >
                  <SelectTrigger id="edit-group" aria-label={t("groups.select_label")}>
                    <SelectValue placeholder={t("groups.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GROUP_VALUE}>{t("groups.none")}</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
