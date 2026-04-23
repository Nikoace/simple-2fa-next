import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";

import { type AccountWithCode, reorderAccounts } from "@/lib/tauri";

import { AccountCard } from "./AccountCard";

function SortableItem({ account }: { account: AccountWithCode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50" : undefined}
      {...attributes}
      {...listeners}
    >
      <AccountCard account={account} />
    </div>
  );
}

type Props = { accounts: AccountWithCode[] };

export function SortableAccountList({ accounts }: Props) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

    const reordered = arrayMove(accounts, oldIndex, newIndex);

    qc.setQueryData<AccountWithCode[]>(["accounts"], reordered);
    await reorderAccounts(reordered.map((account) => account.id));
    await qc.invalidateQueries({ queryKey: ["accounts"] });
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
