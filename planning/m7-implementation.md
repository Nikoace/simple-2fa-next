# M7 实现计划 — 分组管理

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户能创建/重命名/删除账户分组，并把账户分配到分组；主页支持按分组过滤和跨组拖拽。

**Architecture:**
- Rust：新增 `groups` 表（migration），`db/groups.rs`（GroupRepo），`commands/groups.rs`（IPC）
- Frontend：`useGroups` hook，`GroupBar` 水平标签栏，`MainPage` 过滤逻辑，EditAccountDialog 支持分配分组

---

## 前置条件

```bash
bun run test && bun run typecheck   # M6 全绿
cd src-tauri && cargo test
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src-tauri/src/db/groups.rs` | 新建 |
| `src-tauri/src/db/mod.rs` | 修改 — 导出 groups |
| `src-tauri/src/db/migrate.rs` | 修改 — 添加 groups 表 migration |
| `src-tauri/src/commands/groups.rs` | 新建 |
| `src-tauri/src/commands/mod.rs` | 修改 |
| `src-tauri/src/lib.rs` | 修改 — 注册命令 |
| `src/lib/tauri.ts` | 修改 — groups IPC 绑定 |
| `src/hooks/useGroups.ts` | 新建 |
| `src/hooks/useGroups.test.ts` | 新建 |
| `src/components/group/GroupBar.tsx` | 新建 |
| `src/components/group/GroupBar.test.tsx` | 新建 |
| `src/pages/MainPage.tsx` | 修改 — 分组过滤 |
| `src/pages/MainPage.test.tsx` | 修改 |
| `src/i18n/locales/*.json` | 修改 — groups 相关 key |

---

## Task 1: Rust — groups 表 + GroupRepo

**Files:** `src-tauri/src/db/migrate.rs`, `src-tauri/src/db/groups.rs`

- [ ] **添加 migration**（migration 编号接上一条）：
  ```sql
  CREATE TABLE groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  ```
- [ ] **写失败测试**（inline `#[cfg(test)]`）：
  - `GroupRepo::create("Work")` → 返回 Group { id, name: "Work", sort_order: 0 }
  - `GroupRepo::list()` → 按 sort_order 排序
  - `GroupRepo::rename(id, "Personal")` → name 更新
  - `GroupRepo::delete(id)` → 该组账户的 `group_id` 置 NULL
- [ ] **实现 `GroupRepo`**：create / list / rename / delete（delete 时 UPDATE accounts SET group_id=NULL）
- [ ] **跑测试 → PASS，Commit**

```bash
cd src-tauri && cargo test groups
git commit -m "feat(rust): add groups table and GroupRepo"
```

---

## Task 2: Rust — groups Tauri 命令

**Files:** `src-tauri/src/commands/groups.rs`

命令：
- `list_groups() -> Result<Vec<Group>, AppError>`
- `create_group(name: String) -> Result<Group, AppError>`
- `rename_group(id: i64, name: String) -> Result<Group, AppError>`
- `delete_group(id: i64) -> Result<(), AppError>`

TDD 步骤：
- [ ] **写失败测试**（integration，mock AppState）
- [ ] **实现并注册到 invoke_handler**
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(rust): add groups Tauri commands"
```

---

## Task 3: Frontend — tauri.ts + useGroups hook

**Files:** `src/lib/tauri.ts`, `src/hooks/useGroups.ts`

- [ ] 在 `tauri.ts` 添加：
  ```ts
  export type Group = { id: number; name: string; sortOrder: number };
  export const listGroups = () => invoke<Group[]>("list_groups");
  export const createGroup = (name: string) => invoke<Group>("create_group", { name });
  export const renameGroup = (id: number, name: string) => invoke<Group>("rename_group", { id, name });
  export const deleteGroup = (id: number) => invoke<void>("delete_group", { id });
  ```
- [ ] **写失败测试** `useGroups.test.ts`：mock `listGroups`，验证 queryKey `["groups"]`、成功/失败状态
- [ ] **实现 `useGroups`**（同 `useAccounts` 结构，refetchInterval 关闭或长间隔）
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add useGroups hook"
```

---

## Task 4: Frontend — GroupBar 组件

**Files:** `src/components/group/GroupBar.tsx` + `GroupBar.test.tsx`

TDD 步骤：
- [ ] **写失败测试**：
  - 渲染 "全部" 标签 + 各分组标签
  - 点击分组标签触发 `onSelect(groupId)`
  - "全部" 选中时 `onSelect(null)`
  - "+" 按钮点击触发输入框，输入名称 Enter 后调 `createGroup`
- [ ] **实现 `GroupBar`**：
  ```tsx
  // 水平滚动 TabsList（shadcn Tabs or 手写）
  // "全部" tab + groups.map(g => tab) + "+" 新建按钮
  // 新建：inline input，按 Enter 调 createGroup → invalidate(["groups"])
  // 长按 tab → ContextMenu（重命名 / 删除）
  ```
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add GroupBar component"
```

---

## Task 5: Frontend — MainPage 分组过滤

**Files:** `src/pages/MainPage.tsx`, `src/pages/MainPage.test.tsx`

- [ ] **补测试**：选择分组后只渲染该组账户；"全部" 渲染全部
- [ ] **实现**：
  - 维护 `selectedGroupId: number | null` 状态
  - 过滤：`accounts.filter(a => selectedGroupId === null || a.groupId === selectedGroupId)`
  - 在账户列表上方渲染 `<GroupBar>`
- [ ] **跑测试 → PASS，Commit**

---

## Task 6: EditAccountDialog — 分配分组

**Files:** `src/components/account/EditAccountDialog.tsx`

- [ ] 添加分组 `Select`（"无分组" + 各 group）
- [ ] `updateAccount` payload 包含 `groupId`
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add group assignment to EditAccountDialog"
```

---

## 最终验收

```bash
bun run test:coverage
bun run typecheck
bun run lint:ci
cd src-tauri && cargo test
```

**人工验收清单：**
- [ ] 新建分组 "Work" 和 "Personal"
- [ ] 编辑账户 → 分配到 "Work"
- [ ] 点击 "Work" 标签 → 只看到 Work 分组账户
- [ ] 点击 "全部" → 所有账户可见
- [ ] 长按分组标签 → 重命名 / 删除（删除后账户回到无分组）
