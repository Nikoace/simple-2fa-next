import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Group } from "@/lib/tauri";
import { createGroup, deleteGroup, renameGroup } from "@/lib/tauri";

type Props = {
  groups: Group[];
  selectedGroupId: number | null;
  onSelect: (groupId: number | null) => void;
};

export function GroupBar({ groups, selectedGroupId, onSelect }: Readonly<Props>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function submitNewGroup() {
    const name = newName.trim();
    if (!name) return;
    setMutationError(null);
    try {
      await createGroup(name);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      setNewName("");
      setCreating(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function submitRename() {
    if (renamingId === null) return;
    const name = renameValue.trim();
    if (!name) return;
    setMutationError(null);
    try {
      await renameGroup(renamingId, name);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      setRenamingId(null);
      setRenameValue("");
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function confirmDelete() {
    if (deletingGroupId === null) return;
    setMutationError(null);
    try {
      const id = deletingGroupId;
      setDeletingGroupId(null);
      await deleteGroup(id);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      if (selectedGroupId === id) onSelect(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function onNewNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitNewGroup();
    } else if (event.key === "Escape") {
      setCreating(false);
      setNewName("");
    }
  }

  function onRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename();
    } else if (event.key === "Escape") {
      setRenamingId(null);
      setRenameValue("");
    }
  }

  function startRename(group: Group) {
    setRenamingId(group.id);
    setRenameValue(group.name);
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          size="sm"
          variant={selectedGroupId === null ? "default" : "outline"}
          onClick={() => onSelect(null)}
        >
          {t("groups.all")}
        </Button>

        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={selectedGroupId === group.id ? "default" : "outline"}
              onClick={() => onSelect(group.id)}
            >
              {group.name}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-md border p-2 text-muted-foreground hover:text-foreground"
                aria-label={t("groups.actions")}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => startRename(group)}>
                  {t("groups.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeletingGroupId(group.id)}
                >
                  {t("groups.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="mr-1 size-4" />
          {t("groups.add")}
        </Button>
      </div>

      {creating && (
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={onNewNameKeyDown}
          placeholder={t("groups.new_name_placeholder")}
          aria-label={t("groups.new_name_label")}
        />
      )}

      {renamingId !== null && (
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={onRenameKeyDown}
          placeholder={t("groups.new_name_placeholder")}
          aria-label={t("groups.rename_prompt")}
        />
      )}

      {mutationError && <p className="text-sm text-destructive">{mutationError}</p>}

      <AlertDialog
        open={deletingGroupId !== null}
        onOpenChange={(open) => !open && setDeletingGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("groups.delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingGroupId(null)}>
              {t("accounts.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => void confirmDelete()}
            >
              {t("accounts.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
