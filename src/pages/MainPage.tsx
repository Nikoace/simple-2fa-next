import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AddAccountDialog } from "@/components/account/AddAccountDialog";
import { SortableAccountList } from "@/components/account/SortableAccountList";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/useAccounts";

export function MainPage() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading, isError } = useAccounts();

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }

  if (isError) {
    return <p className="py-8 text-center text-destructive">{t("common.error")}</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("accounts.drag_hint")}</p>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 size-4" />
            {t("accounts.add")}
          </Button>
        </div>
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-base font-medium">{t("accounts.empty_title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("accounts.empty_hint")}</p>
        </div>
        <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("accounts.drag_hint")}</p>
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t("accounts.add")}
        </Button>
      </div>
      <SortableAccountList accounts={data} />
      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
