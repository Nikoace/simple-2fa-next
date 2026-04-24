import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureSync, disableSync, getSyncStatus, syncNow, type SyncConfig } from "@/lib/tauri";

type ProviderMode = "disabled" | "WebDav" | "S3";

export function SyncSettingsPage() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<ProviderMode>("disabled");
  const [status, setStatus] = useState<{ lastSync: string | null; lastError: string | null; inProgress: boolean }>({
    lastSync: null,
    lastError: null,
    inProgress: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [webdav, setWebdav] = useState({
    url: "",
    username: "",
    password: "",
    remotePath: "vault.s2fa",
  });

  const [s3, setS3] = useState({
    bucket: "",
    prefix: "",
    region: "us-east-1",
    accessKey: "",
    secretKey: "",
  });

  useEffect(() => {
    void (async () => {
      try {
        const next = await getSyncStatus();
        setStatus(next);
      } catch {
        // Keep defaults if backend is not available yet.
      }
    })();
  }, []);

  const canSave = useMemo(() => {
    if (provider === "disabled") {
      return true;
    }
    if (provider === "WebDav") {
      return Boolean(webdav.url && webdav.username && webdav.password && webdav.remotePath);
    }
    return Boolean(s3.bucket && s3.region && s3.accessKey && s3.secretKey);
  }, [provider, webdav, s3]);

  async function saveConfig() {
    setSubmitting(true);
    setError(null);

    try {
      if (provider === "disabled") {
        await disableSync();
      } else {
        const config: SyncConfig =
          provider === "WebDav"
            ? {
                type: "WebDav",
                url: webdav.url,
                username: webdav.username,
                password: webdav.password,
                remotePath: webdav.remotePath,
              }
            : {
                type: "S3",
                bucket: s3.bucket,
                prefix: s3.prefix,
                region: s3.region,
                accessKey: s3.accessKey,
                secretKey: s3.secretKey,
              };
        await configureSync(config);
      }
    } catch {
      setError(t("settings.save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function runSyncNow() {
    setSubmitting(true);
    setError(null);
    try {
      const next = await syncNow();
      setStatus(next);
    } catch {
      setError(t("settings.save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto mt-8 max-w-2xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("sync.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sync.description")}</p>
        </div>
        <Link to="/settings">
          <Button variant="ghost">{t("sync.back_settings")}</Button>
        </Link>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">{t("sync.provider")}</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderMode)}
          aria-label={t("sync.provider")}
        >
          <option value="disabled">{t("sync.provider_disabled")}</option>
          <option value="WebDav">WebDAV</option>
          <option value="S3">S3</option>
        </select>
      </label>

      {provider === "WebDav" && (
        <div className="grid gap-3">
          <Input
            value={webdav.url}
            onChange={(event) => setWebdav((v) => ({ ...v, url: event.target.value }))}
            placeholder={t("sync.webdav_url")}
            aria-label={t("sync.webdav_url")}
          />
          <Input
            value={webdav.username}
            onChange={(event) => setWebdav((v) => ({ ...v, username: event.target.value }))}
            placeholder={t("sync.webdav_username")}
            aria-label={t("sync.webdav_username")}
          />
          <Input
            type="password"
            value={webdav.password}
            onChange={(event) => setWebdav((v) => ({ ...v, password: event.target.value }))}
            placeholder={t("sync.webdav_password")}
            aria-label={t("sync.webdav_password")}
          />
          <Input
            value={webdav.remotePath}
            onChange={(event) => setWebdav((v) => ({ ...v, remotePath: event.target.value }))}
            placeholder={t("sync.webdav_remote_path")}
            aria-label={t("sync.webdav_remote_path")}
          />
        </div>
      )}

      {provider === "S3" && (
        <div className="grid gap-3">
          <Input
            value={s3.bucket}
            onChange={(event) => setS3((v) => ({ ...v, bucket: event.target.value }))}
            placeholder={t("sync.s3_bucket")}
            aria-label={t("sync.s3_bucket")}
          />
          <Input
            value={s3.prefix}
            onChange={(event) => setS3((v) => ({ ...v, prefix: event.target.value }))}
            placeholder={t("sync.s3_prefix")}
            aria-label={t("sync.s3_prefix")}
          />
          <Input
            value={s3.region}
            onChange={(event) => setS3((v) => ({ ...v, region: event.target.value }))}
            placeholder={t("sync.s3_region")}
            aria-label={t("sync.s3_region")}
          />
          <Input
            value={s3.accessKey}
            onChange={(event) => setS3((v) => ({ ...v, accessKey: event.target.value }))}
            placeholder={t("sync.s3_access_key")}
            aria-label={t("sync.s3_access_key")}
          />
          <Input
            type="password"
            value={s3.secretKey}
            onChange={(event) => setS3((v) => ({ ...v, secretKey: event.target.value }))}
            placeholder={t("sync.s3_secret_key")}
            aria-label={t("sync.s3_secret_key")}
          />
        </div>
      )}

      <div className="rounded-md border p-3 text-sm">
        <p>
          {t("sync.last_sync")}: {status.lastSync ? new Date(status.lastSync).toLocaleString() : "-"}
        </p>
        {status.lastError && <p className="text-destructive">{status.lastError}</p>}
        {status.inProgress && (
          <p className="mt-2 inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("sync.in_progress")}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" onClick={() => void saveConfig()} disabled={submitting || !canSave}>
          {t("sync.save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => void runSyncNow()} disabled={submitting}>
          {t("sync.sync_now")}
        </Button>
      </div>
    </Card>
  );
}
