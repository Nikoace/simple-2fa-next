import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addAccount } from "@/lib/tauri";

const BASE32_RE = /^[A-Z2-7]+=*$/i;

const schema = z.object({
  name: z.string().min(1, "name_required"),
  issuer: z.string().optional(),
  secret: z
    .string()
    .min(1, "secret_required")
    .refine((v) => BASE32_RE.test(v.replace(/\s/g, "")), "secret_invalid"),
  algorithm: z.enum(["SHA1", "SHA256", "SHA512"]),
  digits: z.coerce.number().int().min(6).max(8),
  period: z.coerce.number().int().min(15).max(300),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      issuer: "",
      secret: "",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    },
  });

  const { isSubmitting, isValid } = form.formState;

  function messageFor(errorMessage: unknown) {
    if (typeof errorMessage !== "string") {
      return "";
    }
    return t(`accounts.${errorMessage}`);
  }

  async function onSubmit(values: FormOutput) {
    await addAccount({
      ...values,
      issuer: values.issuer?.trim() || undefined,
      secret: values.secret.replace(/\s/g, "").toUpperCase(),
    });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    form.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounts.add")}</DialogTitle>
          <DialogDescription>{t("accounts.drag_hint")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("accounts.name_label")}</Label>
            <Input
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
            <Label>{t("accounts.issuer_label")}</Label>
            <Input
              aria-label={t("accounts.issuer_label")}
              placeholder={t("accounts.issuer_placeholder")}
              {...form.register("issuer")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("accounts.secret_label")}</Label>
            <Input
              aria-label={t("accounts.secret_label")}
              placeholder={t("accounts.secret_placeholder")}
              autoComplete="off"
              {...form.register("secret")}
            />
            {form.formState.errors.secret?.message && (
              <p className="text-sm text-destructive">
                {messageFor(form.formState.errors.secret.message)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t("accounts.algorithm_label")}</Label>
              <Controller
                control={form.control}
                name="algorithm"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t("accounts.algorithm_label")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHA1">SHA1</SelectItem>
                      <SelectItem value="SHA256">SHA256</SelectItem>
                      <SelectItem value="SHA512">SHA512</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("accounts.digits_label")}</Label>
              <Controller
                control={form.control}
                name="digits"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger aria-label={t("accounts.digits_label")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="7">7</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("accounts.period_label")}</Label>
              <Input
                aria-label={t("accounts.period_label")}
                type="number"
                {...form.register("period", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("accounts.cancel")}
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {t("accounts.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
