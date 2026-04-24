import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

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

  async function submitNewGroup() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    await createGroup(name);
    await qc.invalidateQueries({ queryKey: ["groups"] });
    setNewName("");
    setCreating(false);
  }

  async function handleRename(groupId: number, currentName: string) {
    const nextName = globalThis.prompt(t("groups.rename_prompt"), currentName);
    if (!nextName || nextName.trim() === currentName) {
      return;
    }
    await renameGroup(groupId, nextName.trim());
    await qc.invalidateQueries({ queryKey: ["groups"] });
  }

  async function handleDelete(groupId: number) {
    const confirmed = globalThis.confirm(t("groups.delete_confirm"));
    if (!confirmed) {
      return;
    }
    await deleteGroup(groupId);
    await qc.invalidateQueries({ queryKey: ["groups"] });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    if (selectedGroupId === groupId) {
      onSelect(null);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitNewGroup();
      return;
    }
    if (event.key === "Escape") {
      setCreating(false);
      setNewName("");
    }
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
                <DropdownMenuItem onClick={() => void handleRename(group.id, group.name)}>
                  {t("groups.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => void handleDelete(group.id)}
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
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t("groups.new_name_placeholder")}
          aria-label={t("groups.new_name_label")}
        />
      )}
    </div>
  );
}
