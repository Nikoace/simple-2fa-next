import { useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
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
import { commitImport, type ImportAccountItem, importS2faFile, parseOtpauthUri } from "@/lib/tauri";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Mode = "file" | "uri";

export function ImportDialog({ open: isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("file");
  const [filePath, setFilePath] = useState("");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [previewItems, setPreviewItems] = useState<ImportAccountItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedItems = useMemo(
    () => previewItems.filter((_, index) => selected.has(index)),
    [previewItems, selected],
  );

  function resetState() {
    setMode("file");
    setFilePath("");
    setPassword("");
    setUri("");
    setPreviewItems([]);
    setSelected(new Set());
    setError("");
  }

  async function chooseFile() {
    const result = await open({
      multiple: false,
      filters: [{ name: "s2fa", extensions: ["s2fa"] }],
    });
    if (typeof result === "string") {
      setFilePath(result);
    }
  }

  async function previewFromFile() {
    if (!filePath || !password) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const preview = await importS2faFile(filePath, password);
      setPreviewItems(preview.items);
      setSelected(new Set(preview.items.map((_, index) => index)));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function previewFromUri() {
    const normalized = uri.trim();
    if (!normalized) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const item = await parseOtpauthUri(normalized);
      setPreviewItems([item]);
      setSelected(new Set([0]));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(index: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }

  async function confirmImport() {
    if (selectedItems.length === 0) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await commitImport(selectedItems);
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      resetState();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      modal={false}
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetState();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "file" ? "default" : "ghost"}
              onClick={() => setMode("file")}
            >
              {t("import.file_tab")}
            </Button>
            <Button
              type="button"
              variant={mode === "uri" ? "default" : "ghost"}
              onClick={() => setMode("uri")}
            >
              {t("import.uri_tab")}
            </Button>
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("import.choose_file")}
                  onClick={() => void chooseFile()}
                >
                  {t("import.choose_file")}
                </Button>
                <p className="truncate text-xs text-muted-foreground">{filePath || "-"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-file-path">{t("import.choose_file")}</Label>
                <Input
                  id="import-file-path"
                  aria-label={t("import.choose_file")}
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder={t("import.choose_file")}
                  spellCheck={false}
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("export.password")}</Label>
                <Input
                  aria-label={t("export.password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={() => void previewFromFile()}
                disabled={!filePath || !password || busy}
              >
                {t("import.preview")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("import.uri_input")}</Label>
                <textarea
                  aria-label={t("import.uri_input")}
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                onClick={() => void previewFromUri()}
                disabled={!uri.trim() || busy}
              >
                {t("import.preview")}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("import.preview")}</Label>
            {previewItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("import.empty_preview")}</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-auto rounded-md border p-3">
                {previewItems.map((item, index) => (
                  <label key={item.secret} className="flex items-center gap-2 text-sm">
                    <input
                      aria-label={`${t("import.select_item")} ${item.name}`}
                      type="checkbox"
                      checked={selected.has(index)}
                      onChange={(e) => toggleSelected(index, e.target.checked)}
                    />
                    <span>
                      {item.issuer ? `${item.issuer}: ` : ""}
                      {item.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
            <Button
              type="button"
              onClick={() => void confirmImport()}
              disabled={selectedItems.length === 0 || busy}
            >
              {t("import.confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
