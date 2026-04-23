import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { useNow } from "@/hooks/useNow";
import type { AccountWithCode } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { CodeDisplay } from "./CodeDisplay";
import { CountdownRing } from "./CountdownRing";

type Props = {
  account: AccountWithCode;
  className?: string;
};

export function AccountCard({ account, className }: Props) {
  const { t } = useTranslation();
  const now = useNow();
  const [copied, setCopied] = useState(false);

  const ttl = account.period - (now % account.period);
  const progress = ttl / account.period;
  const isDanger = ttl <= 5;

  async function handleCopy() {
    await navigator.clipboard.writeText(account.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card
      className={cn("flex items-center gap-4 p-4 transition-colors hover:bg-muted/50", className)}
    >
      <CountdownRing period={account.period} progress={progress} danger={isDanger} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{account.name}</p>
        {account.issuer && (
          <p className="truncate text-xs text-muted-foreground">{account.issuer}</p>
        )}
      </div>

      <button
        type="button"
        aria-label="copy"
        onClick={() => void handleCopy()}
        className={cn("text-right transition-colors", isDanger && "text-destructive")}
      >
        <CodeDisplay code={account.code} digits={account.digits} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {copied ? t("accounts.copied") : `${ttl}s`}
        </p>
      </button>
    </Card>
  );
}
