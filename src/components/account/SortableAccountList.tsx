import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type AccountWithCode, reorderAccounts } from "@/lib/tauri";

import { AccountCard } from "./AccountCard";

function SortableItem({ account }: { account: AccountWithCode }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="account-item"
      data-account-name={account.name}
      className={`flex items-center gap-1${isDragging ? " opacity-50" : ""}`}
      {...attributes}
    >
      <button
        type="button"
        aria-label={t("accounts.drag_hint")}
        data-testid="account-drag-handle"
        className="cursor-grab touch-none p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <AccountCard account={account} />
      </div>
    </div>
  );
}

type Props = { accounts: AccountWithCode[] };

export function SortableAccountList({ accounts }: Props) {
  const qc = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = accounts.findIndex((account) => account.id === active.id);
    const newIndex = accounts.findIndex((account) => account.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previous = qc.getQueryData<AccountWithCode[]>(["accounts"]);
    const reordered = arrayMove(accounts, oldIndex, newIndex);

    qc.setQueryData<AccountWithCode[]>(["accounts"], reordered);
    try {
      await reorderAccounts(reordered.map((account) => account.id));
    } catch {
      if (previous !== undefined) {
        qc.setQueryData<AccountWithCode[]>(["accounts"], previous);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      <SortableContext
        items={accounts.map((account) => account.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {accounts.map((account) => (
            <SortableItem key={account.id} account={account} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
