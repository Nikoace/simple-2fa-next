import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNow } from "@/hooks/useNow";
import type { AccountWithCode } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { CodeDisplay } from "./CodeDisplay";
import { CountdownRing } from "./CountdownRing";
import { DeleteAccountAlert } from "./DeleteAccountAlert";
import { EditAccountDialog } from "./EditAccountDialog";

type Props = {
  account: AccountWithCode;
  className?: string;
};

export function AccountCard({ account, className }: Props) {
  const { t } = useTranslation();
  const now = useNow();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const ttl = account.period - (now % account.period);
  const progress = ttl / account.period;
  const isDanger = ttl <= 5;

  async function handleCopy() {
    await navigator.clipboard.writeText(account.code);
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card
      data-testid="account-card"
      data-account-name={account.name}
      className={cn(
        "relative flex items-center gap-4 p-4 transition-colors hover:bg-muted/50",
        className,
      )}
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
        data-testid="copy-code-button"
        onClick={() => void handleCopy()}
        className={cn("text-right transition-colors", isDanger && "text-destructive")}
      >
        <CodeDisplay code={account.code} digits={account.digits} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {copied ? t("accounts.copied") : `${ttl}s`}
        </p>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="options" data-testid="account-options-trigger">
          <span className="rounded p-1 text-muted-foreground hover:bg-muted">
            <MoreVertical className="size-4" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="right-0">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            {t("accounts.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
            {t("accounts.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <EditAccountDialog open={editOpen} account={account} onClose={() => setEditOpen(false)} />
      ) : null}
      {deleteOpen ? (
        <DeleteAccountAlert
          open={deleteOpen}
          account={account}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </Card>
  );
}
