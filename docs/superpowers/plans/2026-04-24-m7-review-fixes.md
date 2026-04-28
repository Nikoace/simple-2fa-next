# M7 Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in the M7 (Groups feature) code review before merging.

**Architecture:** Seven targeted fixes across Rust backend and React frontend. Rust fixes first (serde, vault guard, FK pragma), then frontend refactors (Button variant, GroupBar UX + error handling), then test coverage, then formatting.

**Tech Stack:** Rust/serde, Tauri 2, React 19, shadcn/ui AlertDialog, Vitest, Biome

---

### Task 1: Fix C1 — serde DoubleOption deserialization for `UpdateAccount.group_id`

**Files:**
- Modify: `src-tauri/src/db/repo.rs`

**Problem:** serde 1.x cannot distinguish `{"groupId": null}` (clear group) from `{}` (no-op) for `Option<Option<i64>>`. Both produce outer `None`. The fix is a `#[serde(default, deserialize_with)]` pair.

- [ ] **Step 1: Write failing round-trip test**

Add to the `#[cfg(test)]` block in `src-tauri/src/db/repo.rs` (after the existing `update_can_clear_group_assignment` test):

```rust
#[test]
fn update_group_id_null_clears_via_json() {
    let conn = make_db();
    let groups = GroupRepo(&conn);
    let repo = AccountRepo(&conn);
    let group = groups.create("Work").expect("group create");
    let created = repo
        .create(CreateAccount {
            name: "json-clear".to_string(),
            issuer: None,
            secret_cipher: vec![1u8; 29],
            algorithm: None,
            digits: None,
            period: None,
            icon: None,
            color: None,
            group_id: Some(group.id),
        })
        .expect("create");

    // Simulate frontend sending {"groupId": null} — the serde round-trip path
    let upd: UpdateAccount =
        serde_json::from_str(r#"{"groupId": null}"#).expect("deser must succeed");
    let updated = repo.update(created.id, upd).expect("update must succeed");
    assert_eq!(updated.group_id, None, "groupId:null must clear the group");
}

#[test]
fn update_group_id_absent_is_noop_via_json() {
    let conn = make_db();
    let groups = GroupRepo(&conn);
    let repo = AccountRepo(&conn);
    let group = groups.create("Work").expect("group create");
    let created = repo
        .create(CreateAccount {
            name: "json-noop".to_string(),
            issuer: None,
            secret_cipher: vec![2u8; 29],
            algorithm: None,
            digits: None,
            period: None,
            icon: None,
            color: None,
            group_id: Some(group.id),
        })
        .expect("create");

    // Simulate frontend sending {} — groupId absent means no-op
    let upd: UpdateAccount =
        serde_json::from_str(r#"{}"#).expect("deser must succeed");
    let updated = repo.update(created.id, upd).expect("update must succeed");
    assert_eq!(
        updated.group_id,
        Some(group.id),
        "absent groupId must not change existing group"
    );
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd src-tauri && cargo test update_group_id 2>&1 | tail -20
```

Expected: `update_group_id_null_clears_via_json` FAILS (groupId is not cleared because both `null` and absent both become `None`).

- [ ] **Step 3: Add custom serde deserializer and fix UpdateAccount**

In `src-tauri/src/db/repo.rs`, add the helper module **above** the `UpdateAccount` struct definition:

```rust
mod serde_helpers {
    use serde::{Deserialize, Deserializer};

    pub fn deserialize_optional_option<'de, T, D>(
        deserializer: D,
    ) -> Result<Option<Option<T>>, D::Error>
    where
        T: Deserialize<'de>,
        D: Deserializer<'de>,
    {
        Option::<T>::deserialize(deserializer).map(Some)
    }
}
```

Then update the `UpdateAccount` struct's `group_id` field:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub issuer: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(default, deserialize_with = "serde_helpers::deserialize_optional_option")]
    pub group_id: Option<Option<i64>>,
    pub notes: Option<String>,
}
```

Also add `serde_json` to `[dev-dependencies]` in `src-tauri/Cargo.toml` (needed by the new tests):

```toml
[dev-dependencies]
proptest = "1"
serde_json = "1"
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd src-tauri && cargo test update_group_id 2>&1 | tail -10
```

Expected: both tests PASS.

- [ ] **Step 5: Run full Rust test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: all tests pass, no warnings (if clippy warnings appear, fix before committing).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/db/repo.rs src-tauri/Cargo.toml
git commit -m "fix(rust): fix serde double-option for UpdateAccount.group_id"
```

---

### Task 2: Fix C2 — Add `"outline"` variant to Button component

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Update Button type and styles**

Replace the current `ButtonProps` type and `className` logic:

```tsx
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
};
```

Add the `outline` style after the `ghost` line:

```tsx
variant === "outline" && "border hover:bg-muted",
```

Full updated `className` block in `Button`:

```tsx
className={cn(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
  variant === "ghost" && "hover:bg-muted",
  variant === "outline" && "border hover:bg-muted",
  size === "default" && "h-10 px-4 py-2",
  size === "sm" && "h-9 px-3",
  size === "icon" && "h-9 w-9",
  className,
)}
```

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck 2>&1 | grep -E "error|GroupBar" | head -20
```

Expected: no TypeScript errors in `GroupBar.tsx` about variant.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "fix(frontend): add outline variant to Button component"
```

---

### Task 3: Fix I1 — Add vault lock check to all group commands

**Files:**
- Modify: `src-tauri/src/commands/groups.rs`

Group metadata doesn't contain secrets, but the security model is: locked vault = no data access at all. All four commands need the guard.

- [ ] **Step 1: Add vault check to all four commands**

Replace the entire file content:

```rust
use tauri::State;

use crate::{
    db::repo::{Group, GroupRepo},
    error::AppError,
    state::AppState,
};

#[tauri::command]
pub fn list_groups(state: State<'_, AppState>) -> Result<Vec<Group>, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).list()
}

#[tauri::command]
pub fn create_group(name: String, state: State<'_, AppState>) -> Result<Group, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).create(&name)
}

#[tauri::command]
pub fn rename_group(
    id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<Group, AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).rename(id, &name)
}

#[tauri::command]
pub fn delete_group(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let vault = state.vault.lock().expect("vault lock poisoned");
    if vault.is_none() {
        return Err(AppError::VaultLocked);
    }
    let db = state.db.lock().expect("db lock poisoned");
    GroupRepo(&db).delete(id)
}
```

- [ ] **Step 2: Compile check**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/groups.rs
git commit -m "fix(rust): add vault lock guard to all group commands"
```

---

### Task 4: Fix I5 — Enable PRAGMA foreign_keys per connection

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/db/repo.rs` (the `make_db` test helper)

`PRAGMA foreign_keys = ON` must be set on each connection; it's not persisted to the DB file. Currently the `ON DELETE SET NULL` FK constraint in the schema is silently ignored.

- [ ] **Step 1: Enable FK in production connection**

In `src-tauri/src/lib.rs`, after line 28 (`rusqlite::Connection::open`), add the pragma:

```rust
let mut conn =
    rusqlite::Connection::open(&db_path).expect("failed to open database");
conn.execute_batch("PRAGMA foreign_keys = ON")
    .expect("failed to enable foreign keys");
run_migrations(&mut conn).expect("migration failed");
```

- [ ] **Step 2: Enable FK in test helper**

In `src-tauri/src/db/repo.rs`, update `make_db()` in `#[cfg(test)]`:

```rust
fn make_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db must open");
    run_migrations(&mut conn).expect("migrations must succeed");
    conn.execute_batch("PRAGMA foreign_keys = ON")
        .expect("failed to enable foreign keys");
    conn
}
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -15
```

Expected: all tests still pass (the manual cascade in `GroupRepo::delete` is still there; FK enforcement is additive).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/db/repo.rs
git commit -m "fix(rust): enable PRAGMA foreign_keys = ON per connection"
```

---

### Task 5: Fix I2+I3 — GroupBar: replace prompt/confirm with proper UI + add error handling

**Files:**
- Modify: `src/components/group/GroupBar.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/zh-CN.json`

Replace `globalThis.prompt()` with an inline rename Input (matching the existing `creating` UX pattern), replace `globalThis.confirm()` with an `AlertDialog`, and add try/catch error handling for all mutations.

- [ ] **Step 1: Add i18n key for delete confirmation dialog title**

In `src/i18n/locales/en.json`, add inside the `"groups"` object:
```json
"delete_confirm_title": "Delete Group"
```

In `src/i18n/locales/ja.json`, add inside the `"groups"` object:
```json
"delete_confirm_title": "グループを削除"
```

In `src/i18n/locales/zh-CN.json`, add inside the `"groups"` object:
```json
"delete_confirm_title": "删除分组"
```

- [ ] **Step 2: Rewrite GroupBar.tsx**

Replace the full file with:

```tsx
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

      {mutationError && (
        <p className="text-sm text-destructive">{mutationError}</p>
      )}

      <AlertDialog open={deletingGroupId !== null} onOpenChange={(open) => !open && setDeletingGroupId(null)}>
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
```

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck 2>&1 | grep -E "^src/components/group" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/group/GroupBar.tsx src/i18n/locales/en.json src/i18n/locales/ja.json src/i18n/locales/zh-CN.json
git commit -m "fix(frontend): replace prompt/confirm with inline input and AlertDialog in GroupBar, add error handling"
```

---

### Task 6: Fix I4+m5 — Add missing tests: GroupBar rename/delete + MainPage filtered-empty

**Files:**
- Modify: `src/components/group/GroupBar.test.tsx`
- Modify: `src/pages/MainPage.test.tsx`

- [ ] **Step 1: Rewrite GroupBar.test.tsx**

Replace the full file content (removes `globalThis` spies, adds rename/delete tests):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { GroupBar } from "./GroupBar";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const groups = [
  { id: 1, name: "Work", sortOrder: 0 },
  { id: 2, name: "Personal", sortOrder: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GroupBar", () => {
  it("renders all tab and group tabs", () => {
    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    expect(screen.getByRole("button", { name: /all|全部/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personal" })).toBeTruthy();
  });

  it("calls onSelect with group id when clicking a group", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={onSelect} />, { wrapper });

    await user.click(screen.getByRole("button", { name: "Work" }));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onSelect(null) when clicking all", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<GroupBar groups={groups} selectedGroupId={1} onSelect={onSelect} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /all|全部/i }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("creates group on Enter from inline input", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.createGroup).mockResolvedValue({ id: 3, name: "School", sortOrder: 2 });

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole("button", { name: /add group|添加分组|グループ追加/i }));
    const input = screen.getByLabelText(/group name|分组名称|グループ名/i);
    await user.type(input, "School{Enter}");

    await waitFor(() => expect(tauri.createGroup).toHaveBeenCalledWith("School"));
  });

  it("renames group on Enter from rename input", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.renameGroup).mockResolvedValue({ id: 1, name: "Work2", sortOrder: 0 });

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getAllByLabelText(/group actions|グループ操作|分组操作/i)[0]);
    await user.click(screen.getByRole("menuitem", { name: /rename|改名|リネーム/i }));

    const input = screen.getByLabelText(/rename group|重命名分组|グループ名変更/i);
    expect(input).toBeTruthy();

    await user.clear(input);
    await user.type(input, "Work2{Enter}");

    await waitFor(() => expect(tauri.renameGroup).toHaveBeenCalledWith(1, "Work2"));
  });

  it("deletes group after confirming AlertDialog", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.deleteGroup).mockResolvedValue(undefined);

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getAllByLabelText(/group actions|グループ操作|分组操作/i)[0]);
    await user.click(screen.getByRole("menuitem", { name: /delete|删除|削除/i }));

    const confirmBtn = await screen.findByRole("button", { name: /^delete$|^删除$|^削除$/i });
    await user.click(confirmBtn);

    await waitFor(() => expect(tauri.deleteGroup).toHaveBeenCalledWith(1));
  });

  it("cancels delete when clicking Cancel in AlertDialog", async () => {
    const user = userEvent.setup();

    render(<GroupBar groups={groups} selectedGroupId={null} onSelect={vi.fn()} />, { wrapper });

    await user.click(screen.getAllByLabelText(/group actions|グループ操作|分组操作/i)[0]);
    await user.click(screen.getByRole("menuitem", { name: /delete|删除|削除/i }));

    const cancelBtn = await screen.findByRole("button", { name: /cancel|取消|キャンセル/i });
    await user.click(cancelBtn);

    expect(tauri.deleteGroup).not.toHaveBeenCalled();
  });

  it("calls onSelect(null) after deleting the selected group", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(tauri.deleteGroup).mockResolvedValue(undefined);

    render(<GroupBar groups={groups} selectedGroupId={1} onSelect={onSelect} />, { wrapper });

    await user.click(screen.getAllByLabelText(/group actions|グループ操作|分组操作/i)[0]);
    await user.click(screen.getByRole("menuitem", { name: /delete|删除|削除/i }));

    const confirmBtn = await screen.findByRole("button", { name: /^delete$|^删除$|^削除$/i });
    await user.click(confirmBtn);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });
});
```

- [ ] **Step 2: Add filtered-empty-state test to MainPage.test.tsx**

Add this test case inside the `describe("MainPage", ...)` block, after the existing `"filters accounts by selected group"` test:

```tsx
it("shows empty-group message when filter has no matches", async () => {
  vi.mocked(tauri.listGroups).mockResolvedValue([
    { id: 1, name: "Work", sortOrder: 0 },
  ]);
  vi.mocked(tauri.getAccounts).mockResolvedValue([
    {
      id: 1,
      name: "GitHub",
      issuer: "GitHub",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      groupId: null,
      icon: null,
      color: null,
      sortOrder: 0,
      code: "123456",
      ttl: 15,
      progress: 0.5,
    },
  ]);

  renderWithQuery(<MainPage />);

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Work" })).toBeTruthy(),
  );

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Work" }));

  await waitFor(() =>
    expect(
      screen.getByText(/no accounts in this group|该分组下没有账户|このグループにはアカウントがありません/i),
    ).toBeTruthy(),
  );
});
```

- [ ] **Step 3: Run frontend tests**

```bash
bun run test -- --reporter=verbose 2>&1 | tail -40
```

Expected: all tests pass, including the 6 new GroupBar tests and the new MainPage test.

- [ ] **Step 4: Commit**

```bash
git add src/components/group/GroupBar.test.tsx src/pages/MainPage.test.tsx
git commit -m "test(frontend): add GroupBar rename/delete tests, remove globalThis spies, add MainPage empty-filter test"
```

---

### Task 7: Fix m3 + m1 — staleTime and Biome format

**Files:**
- Modify: `src/hooks/useGroups.ts`
- Run: `bun run format`

- [ ] **Step 1: Update staleTime in useGroups**

In `src/hooks/useGroups.ts`, change `staleTime: 0` to `staleTime: 30_000`:

```ts
export function useGroups() {
  const query = useQuery({
    queryKey: groupsQueryKey,
    queryFn: listGroups,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return { ...query, queryKey: groupsQueryKey };
}
```

- [ ] **Step 2: Run Biome format**

```bash
bun run format
```

Expected: formats `GroupBar.tsx` and any other files with formatting issues.

- [ ] **Step 3: Run lint**

```bash
bun run lint:ci 2>&1 | tail -20
```

Expected: no lint errors.

- [ ] **Step 4: Run full test suite one last time**

```bash
bun run test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGroups.ts src/components/group/GroupBar.tsx src/components/group/GroupBar.test.tsx
git commit -m "fix(frontend): set staleTime=30s for useGroups, fix Biome formatting"
```
