import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ScanConfirmDialog } from "@/components/account/ScanConfirmDialog";
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
import { useScreenScan } from "@/hooks/useScreenScan";
import { addAccount, type ImportAccountItem } from "@/lib/tauri";

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
  const { result: scanResult, scan, reset: resetScan } = useScreenScan();

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  function messageFor(errorMessage: unknown) {
    if (typeof errorMessage !== "string") {
      return "";
    }
    return t(`accounts.${errorMessage}`);
  }

  async function onSubmit(values: FormOutput) {
    setSubmitError(null);
    try {
      await addAccount({
        ...values,
        issuer: values.issuer?.trim() || undefined,
        secret: values.secret.replace(/\s/g, "").toUpperCase(),
      });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      form.reset();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleScanConfirm(item: ImportAccountItem) {
    await addAccount({
      name: item.name,
      issuer: item.issuer,
      secret: item.secret,
      algorithm: item.algorithm,
      digits: item.digits,
      period: item.period,
    });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    resetScan();
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("accounts.add")}</DialogTitle>
          </DialogHeader>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            aria-label={t("scan.scan_screen")}
            disabled={scanResult.status === "scanning"}
            onClick={() => void scan()}
          >
            <ScanLine className="mr-2 size-4" />
            {scanResult.status === "scanning" ? t("scan.scanning") : t("scan.scan_screen")}
          </Button>

          {scanResult.status === "not_found" && (
            <p className="text-center text-sm text-destructive">
              {t("scan.not_found")}
              <Button
                type="button"
                variant="ghost"
                className="ml-1 h-auto p-0 text-sm"
                onClick={() => void scan()}
              >
                {t("scan.retry")}
              </Button>
            </p>
          )}

          {scanResult.status === "error" && (
            <p className="text-center text-sm text-destructive">{scanResult.message}</p>
          )}

          <div className="relative flex items-center gap-2 py-1">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">{t("common.or")}</span>
            <div className="flex-1 border-t" />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">{t("accounts.name_label")}</Label>
              <Input
                id="add-name"
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
              <Label htmlFor="add-issuer">{t("accounts.issuer_label")}</Label>
              <Input
                id="add-issuer"
                aria-label={t("accounts.issuer_label")}
                placeholder={t("accounts.issuer_placeholder")}
                {...form.register("issuer")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-secret">{t("accounts.secret_label")}</Label>
              <Input
                id="add-secret"
                aria-label={t("accounts.secret_label")}
                placeholder={t("accounts.secret_placeholder")}
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="characters"
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
                <Label htmlFor="add-algorithm">{t("accounts.algorithm_label")}</Label>
                <Controller
                  control={form.control}
                  name="algorithm"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="add-algorithm" aria-label={t("accounts.algorithm_label")}>
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
                <Label htmlFor="add-digits">{t("accounts.digits_label")}</Label>
                <Controller
                  control={form.control}
                  name="digits"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id="add-digits" aria-label={t("accounts.digits_label")}>
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
                <Label htmlFor="add-period">{t("accounts.period_label")}</Label>
                <Input
                  id="add-period"
                  aria-label={t("accounts.period_label")}
                  type="number"
                  {...form.register("period", { valueAsNumber: true })}
                />
              </div>
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-add-account"
                onClick={onClose}
              >
                {t("accounts.cancel")}
              </Button>
              <Button
                type="submit"
                data-testid="submit-add-account"
                disabled={!isValid || isSubmitting}
              >
                {t("accounts.add")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ScanConfirmDialog
        item={scanResult.status === "found" ? scanResult.item : null}
        onConfirm={(item) => void handleScanConfirm(item)}
        onCancel={resetScan}
      />
    </>
  );
}
