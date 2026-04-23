# M5 实现计划 — 账户管理 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在前端完整地增删改账户，并用 dnd-kit 拖拽调整顺序。后端 IPC 已全部就绪（`add_account`, `update_account`, `delete_account`, `reorder_accounts`），本里程碑纯前端。

**Architecture:** `AddAccountDialog`（shadcn Dialog + 受控表单）、`EditAccountDialog`、`DeleteAccountAlert`（AlertDialog）、`SortableAccountList`（dnd-kit DndContext + SortableContext + useSortable）；全部集成进 `MainPage`；操作完成后统一 `queryClient.invalidateQueries(["accounts"])`。

**Tech Stack:** shadcn/ui（dialog / alert-dialog / form / label）、dnd-kit（@dnd-kit/core + @dnd-kit/sortable）、react-hook-form + zod（表单校验）

---

## 前置条件检查

```bash
cd /home/niko/hobby/simple-2fa-next
bun run test          # 全绿（93 tests）
bun run typecheck     # 0 errors
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src/components/account/AddAccountDialog.tsx` | 新建 |
| `src/components/account/AddAccountDialog.test.tsx` | 新建 |
| `src/components/account/EditAccountDialog.tsx` | 新建 |
| `src/components/account/EditAccountDialog.test.tsx` | 新建 |
| `src/components/account/DeleteAccountAlert.tsx` | 新建 |
| `src/components/account/DeleteAccountAlert.test.tsx` | 新建 |
| `src/components/account/SortableAccountList.tsx` | 新建 |
| `src/components/account/SortableAccountList.test.tsx` | 新建 |
| `src/components/account/AccountCard.tsx` | 修改 — 添加操作菜单 |
| `src/components/account/AccountCard.test.tsx` | 修改 — 补测试 |
| `src/pages/MainPage.tsx` | 修改 — 集成新组件 |
| `src/pages/MainPage.test.tsx` | 修改 — 补测试 |
| `src/i18n/locales/zh-CN.json` | 修改 — 添加 accounts.add/edit/delete 等 |
| `src/i18n/locales/en.json` | 修改 |
| `src/i18n/locales/ja.json` | 修改 |

---

## Task 1: 安装依赖 + 补充翻译键

- [ ] **Step 1: 安装 shadcn 组件和 dnd-kit**

```bash
cd /home/niko/hobby/simple-2fa-next
bunx shadcn@latest add dialog alert-dialog form label badge
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
bun add react-hook-form zod @hookform/resolvers
```

- [ ] **Step 2: 补充 i18n 翻译键**

在三个 locale 文件的 `accounts` 对象中追加：

`src/i18n/locales/zh-CN.json` 追加（`accounts` 节点内）：
```json
"add": "添加账户",
"edit": "编辑",
"delete": "删除",
"delete_confirm_title": "确认删除",
"delete_confirm_desc": "删除后无法恢复，确定要删除「{{name}}」吗？",
"name_label": "账户名称",
"name_placeholder": "例如：alice@example.com",
"issuer_label": "服务提供商",
"issuer_placeholder": "例如：GitHub",
"secret_label": "密钥（Base32）",
"secret_placeholder": "JBSWY3DPEHPK3PXP",
"algorithm_label": "算法",
"digits_label": "位数",
"period_label": "刷新周期（秒）",
"name_required": "账户名称不能为空",
"secret_required": "密钥不能为空",
"secret_invalid": "密钥必须是有效的 Base32 字符串",
"save": "保存",
"cancel": "取消",
"drag_hint": "拖拽调整顺序"
```

`en.json` 和 `ja.json` 同步补充对应翻译。

- [ ] **Step 3: 跑 i18n 覆盖率测试**

```bash
bun run test src/i18n/i18n.test.ts
```

若 key 列表变化则同步更新 `src/i18n/i18n.test.ts` 中的 `requiredKeys`。

- [ ] **Step 4: Commit**

```bash
git add src/i18n/
git commit -m "feat(frontend): add M5 i18n keys for account management"
```

---

## Task 2: AddAccountDialog

**Files:**
- Create: `src/components/account/AddAccountDialog.tsx`
- Create: `src/components/account/AddAccountDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/account/AddAccountDialog.test.tsx`：

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/tauri", () => ({
  addAccount: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { AddAccountDialog } from "./AddAccountDialog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddAccountDialog", () => {
  it("renders when open=true", () => {
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("submit button is disabled when required fields are empty", () => {
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    expect(screen.getByRole("button", { name: /add|添加|追加/i })).toBeDisabled();
  });

  it("calls addAccount with correct payload on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.addAccount).mockResolvedValue({
      id: 1, name: "GitHub", issuer: "GitHub", algorithm: "SHA1",
      digits: 6, period: 30, groupId: null, icon: null, color: null,
      sortOrder: 0, code: "123456", ttl: 15, progress: 0.5,
    });

    render(<AddAccountDialog open onClose={onClose} />, { wrapper });

    await user.type(screen.getByLabelText(/name|名称/i), "GitHub");
    await user.type(screen.getByLabelText(/secret|密钥/i), "JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() =>
      expect(tauri.addAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" }),
      ),
    );
  });

  it("shows validation error when secret is not Base32", async () => {
    const user = userEvent.setup();
    render(<AddAccountDialog open onClose={onClose} />, { wrapper });

    await user.type(screen.getByLabelText(/name|名称/i), "Test");
    await user.type(screen.getByLabelText(/secret|密钥/i), "not-base32!!");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() =>
      expect(screen.getByText(/base32/i)).toBeTruthy(),
    );
    expect(tauri.addAccount).not.toHaveBeenCalled();
  });

  it("calls onClose after successful submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.addAccount).mockResolvedValue({
      id: 1, name: "X", issuer: null, algorithm: "SHA1",
      digits: 6, period: 30, groupId: null, icon: null, color: null,
      sortOrder: 0, code: "000000", ttl: 30, progress: 1,
    });

    render(<AddAccountDialog open onClose={onClose} />, { wrapper });
    await user.type(screen.getByLabelText(/name|名称/i), "X");
    await user.type(screen.getByLabelText(/secret|密钥/i), "JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: /add|添加|追加/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

```bash
bun run test src/components/account/AddAccountDialog.test.tsx
```

预期：**FAIL** — `Cannot find module './AddAccountDialog'`

- [ ] **Step 2: 实现**

新建 `src/components/account/AddAccountDialog.tsx`：

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addAccount } from "@/lib/tauri";

const BASE32_RE = /^[A-Z2-7]+=*$/i;

const schema = z.object({
  name: z.string().min(1, "name_required"),
  issuer: z.string().optional(),
  secret: z
    .string()
    .min(1, "secret_required")
    .refine((v) => BASE32_RE.test(v.replace(/\s/g, "")), "secret_invalid"),
  algorithm: z.enum(["SHA1", "SHA256", "SHA512"]).default("SHA1"),
  digits: z.coerce.number().int().min(6).max(8).default(6),
  period: z.coerce.number().int().min(15).max(300).default(30),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { algorithm: "SHA1", digits: 6, period: 30 },
  });

  const { isSubmitting, isValid } = form.formState;

  async function onSubmit(values: FormValues) {
    await addAccount({
      ...values,
      secret: values.secret.replace(/\s/g, "").toUpperCase(),
    });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    form.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounts.add")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("accounts.name_label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("accounts.name_placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issuer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("accounts.issuer_label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("accounts.issuer_placeholder")} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("accounts.secret_label")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("accounts.secret_placeholder")}
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="algorithm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("accounts.algorithm_label")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SHA1">SHA1</SelectItem>
                        <SelectItem value="SHA256">SHA256</SelectItem>
                        <SelectItem value="SHA512">SHA512</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="digits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("accounts.digits_label")}</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="7">7</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("accounts.period_label")}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("accounts.cancel")}
              </Button>
              <Button type="submit" disabled={!isValid || isSubmitting}>
                {t("accounts.add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/components/account/AddAccountDialog.test.tsx
```

预期：**PASS** 5 tests

- [ ] **Step 4: Commit**

```bash
git add src/components/account/AddAccountDialog.tsx src/components/account/AddAccountDialog.test.tsx
git commit -m "feat(frontend): add AddAccountDialog with zod validation"
```

---

## Task 3: EditAccountDialog

**Files:**
- Create: `src/components/account/EditAccountDialog.tsx`
- Create: `src/components/account/EditAccountDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/account/EditAccountDialog.test.tsx`：

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/tauri", () => ({ updateAccount: vi.fn() }));

import * as tauri from "@/lib/tauri";
import type { AccountWithCode } from "@/lib/tauri";
import { EditAccountDialog } from "./EditAccountDialog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const account: AccountWithCode = {
  id: 1, name: "GitHub", issuer: "GitHub Inc", algorithm: "SHA1",
  digits: 6, period: 30, groupId: null, icon: null, color: null,
  sortOrder: 0, code: "123456", ttl: 15, progress: 0.5,
};
const onClose = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe("EditAccountDialog", () => {
  it("pre-fills name and issuer fields", () => {
    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    expect((screen.getByLabelText(/name|名称/i) as HTMLInputElement).value).toBe("GitHub");
    expect((screen.getByLabelText(/issuer|服务/i) as HTMLInputElement).value).toBe("GitHub Inc");
  });

  it("calls updateAccount on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.updateAccount).mockResolvedValue({ ...account, name: "GL" });

    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    const nameInput = screen.getByLabelText(/name|名称/i);
    await user.clear(nameInput);
    await user.type(nameInput, "GL");
    await user.click(screen.getByRole("button", { name: /save|保存|保存/i }));

    await waitFor(() =>
      expect(tauri.updateAccount).toHaveBeenCalledWith(1, expect.objectContaining({ name: "GL" })),
    );
  });

  it("calls onClose after successful submit", async () => {
    const user = userEvent.setup();
    vi.mocked(tauri.updateAccount).mockResolvedValue(account);
    render(<EditAccountDialog open account={account} onClose={onClose} />, { wrapper });
    await user.click(screen.getByRole("button", { name: /save|保存/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: 实现**

新建 `src/components/account/EditAccountDialog.tsx`，结构同 `AddAccountDialog`，但：
- props 包含 `account: AccountWithCode`
- form `defaultValues` 来自 `account`（name / issuer / icon / color）
- 提交调用 `updateAccount(account.id, values)` 而非 `addAccount`
- 不包含 secret / algorithm / digits / period 字段（修改密钥需删除重建）

- [ ] **Step 3: 跑测试 → PASS，Commit**

```bash
bun run test src/components/account/EditAccountDialog.test.tsx
git add src/components/account/EditAccountDialog.tsx src/components/account/EditAccountDialog.test.tsx
git commit -m "feat(frontend): add EditAccountDialog"
```

---

## Task 4: DeleteAccountAlert

**Files:**
- Create: `src/components/account/DeleteAccountAlert.tsx`
- Create: `src/components/account/DeleteAccountAlert.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// 验证：确认按钮调用 deleteAccount(id)；取消按钮不调用；成功后 invalidate + onClose
```

- [ ] **Step 2: 实现**

```tsx
// AlertDialog — title=t("accounts.delete_confirm_title")
// description=t("accounts.delete_confirm_desc", { name: account.name })
// Confirm → deleteAccount(account.id) → invalidate(["accounts"]) → onClose
```

- [ ] **Step 3: 跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add DeleteAccountAlert"
```

---

## Task 5: AccountCard — 操作菜单

**Files:**
- Modify: `src/components/account/AccountCard.tsx`
- Modify: `src/components/account/AccountCard.test.tsx`

- [ ] **Step 1: 补失败测试**

在现有测试文件中添加：
```tsx
it("shows edit and delete options in dropdown menu", async () => {
  const user = userEvent.setup();
  render(<AccountCard account={account} />);
  await user.click(screen.getByRole("button", { name: /more|options|更多/i }));
  expect(screen.getByText(/edit|编辑/i)).toBeTruthy();
  expect(screen.getByText(/delete|删除/i)).toBeTruthy();
});
```

- [ ] **Step 2: 实现**

在 `AccountCard` 右侧加竖排三点 `DropdownMenu`：
- "编辑" → 打开 `EditAccountDialog`（内嵌 dialog state）
- "删除" → 打开 `DeleteAccountAlert`
- `AddAccountDialog` / `EditAccountDialog` / `DeleteAccountAlert` 均通过 `open` prop 控制

- [ ] **Step 3: 跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add edit/delete actions to AccountCard"
```

---

## Task 6: SortableAccountList（dnd-kit 拖拽排序）

**Files:**
- Create: `src/components/account/SortableAccountList.tsx`
- Create: `src/components/account/SortableAccountList.test.tsx`
- Modify: `src/pages/MainPage.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({ reorderAccounts: vi.fn() }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));
vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type { AccountWithCode } from "@/lib/tauri";
import { SortableAccountList } from "./SortableAccountList";

const accounts: AccountWithCode[] = [
  { id: 1, name: "A", issuer: null, algorithm: "SHA1", digits: 6, period: 30,
    groupId: null, icon: null, color: null, sortOrder: 0, code: "111111", ttl: 15, progress: 0.5 },
  { id: 2, name: "B", issuer: null, algorithm: "SHA1", digits: 6, period: 30,
    groupId: null, icon: null, color: null, sortOrder: 1, code: "222222", ttl: 15, progress: 0.5 },
];

describe("SortableAccountList", () => {
  it("renders all account cards", () => {
    render(<SortableAccountList accounts={accounts} />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 实现**

新建 `src/components/account/SortableAccountList.tsx`：

```tsx
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";

import { reorderAccounts } from "@/lib/tauri";
import type { AccountWithCode } from "@/lib/tauri";
import { AccountCard } from "./AccountCard";

function SortableItem({ account }: { account: AccountWithCode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: account.id });

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
    if (!over || active.id === over.id) return;

    const oldIndex = accounts.findIndex((a) => a.id === active.id);
    const newIndex = accounts.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(accounts, oldIndex, newIndex);

    // Optimistic update
    qc.setQueryData<AccountWithCode[]>(["accounts"], reordered);
    await reorderAccounts(reordered.map((a) => a.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
      <SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {accounts.map((account) => (
            <SortableItem key={account.id} account={account} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 3: 更新 MainPage 使用 SortableAccountList**

替换 `MainPage` 中的 `accounts.map(...)` 为 `<SortableAccountList accounts={accounts} />`，并在 header 右侧加 `AddAccountDialog` 触发按钮（`+` 图标按钮）。

- [ ] **Step 4: 跑全量测试**

```bash
bun run test
```

预期：所有测试通过

- [ ] **Step 5: Typecheck**

```bash
bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/account/SortableAccountList.tsx src/components/account/SortableAccountList.test.tsx \
        src/pages/MainPage.tsx src/pages/MainPage.test.tsx
git commit -m "feat(frontend): add SortableAccountList with dnd-kit drag reorder"
```

---

## 最终验收

```bash
bun run test:coverage   # 覆盖率 ≥ 80%
bun run typecheck       # 0 errors
bun run lint:ci         # 零错
cd src-tauri && cargo test   # Rust 测试不受影响
```

**人工验收清单（dev 模式）：**
- [ ] 点击 `+` → 打开 AddAccountDialog → 填写信息 → 提交 → 账户出现在列表
- [ ] 表单校验：空 name / 非 Base32 secret 给出错误提示，无法提交
- [ ] 点击 AccountCard 三点菜单 → 编辑 → 修改名称 → 保存 → 卡片更新
- [ ] 三点菜单 → 删除 → 确认 → 账户消失
- [ ] 长按并拖拽卡片 → 松手后顺序保持
- [ ] 刷新后顺序仍是拖拽后的结果
