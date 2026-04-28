import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AddAccountDialog } from "@/components/account/AddAccountDialog";
import { SortableAccountList } from "@/components/account/SortableAccountList";
import { GroupBar } from "@/components/group/GroupBar";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/useAccounts";
import { useGroups } from "@/hooks/useGroups";

export function MainPage() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { data, isLoading, isError } = useAccounts();
  const { data: groups = [] } = useGroups();

  const filtered =
    data?.filter((account) => selectedGroupId === null || account.groupId === selectedGroupId) ??
    [];

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }

  if (isError) {
    return <p className="py-8 text-center text-destructive">{t("common.error")}</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-3">
        <GroupBar groups={groups} selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("accounts.drag_hint")}</p>
          <Button
            type="button"
            size="sm"
            data-testid="open-add-account"
            onClick={() => setAddOpen(true)}
          >
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
      <GroupBar groups={groups} selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("accounts.drag_hint")}</p>
        <Button
          type="button"
          size="sm"
          data-testid="open-add-account"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 size-4" />
          {t("accounts.add")}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("groups.empty_in_filter")}
        </div>
      ) : (
        <SortableAccountList accounts={filtered} />
      )}
      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
