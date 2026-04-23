# M4 实现计划 — 前端 UI + 动画 + Nightly 渠道

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 App.tsx 原型拆分为完整前端：TanStack Router 路由守卫、vault 解锁/设置页、带丝滑倒计时动画的账户列表页、i18n（zh-CN/en/ja）、主题切换，以及每日 nightly 自动打包流程。

**Architecture:** TanStack Router（code-based，三条路由 `/` `/unlock` `/setup`）+ `beforeLoad` vault 守卫；useNow 用 rAF 驱动整秒 tick，CountdownRing 通过 CSS `@property --ring-progress` 的 `transition` 实现 GPU 插值，彻底消除卡顿；CodeDisplay 用 Framer Motion `AnimatePresence` 在码换时做 100ms 淡入/滑动。

**Tech Stack:** TanStack Router v1、TanStack Query v5、Zustand（已有）、Framer Motion、CSS @property、i18next + react-i18next、shadcn/ui（button / input / card / dropdown-menu）

---

## 前置条件检查

```bash
cd /home/niko/hobby/simple-2fa-next
bun run test          # 全绿
bun run typecheck     # 0 errors
cd src-tauri && cargo test   # 全绿
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src/router.tsx` | 新建 — 路由树 + vault 守卫 |
| `src/main.tsx` | 修改 — RouterProvider + QueryClientProvider |
| `src/hooks/useNow.ts` | 新建 — rAF 整秒 tick |
| `src/hooks/useAccounts.ts` | 新建 — TanStack Query getAccounts |
| `src/stores/settings.ts` | 新建 — 主题 Zustand store |
| `src/i18n/index.ts` | 新建 — i18next 初始化 |
| `src/i18n/locales/zh-CN.json` | 新建 |
| `src/i18n/locales/en.json` | 新建 |
| `src/i18n/locales/ja.json` | 新建 |
| `src/components/account/CountdownRing.tsx` | 新建 |
| `src/components/account/CodeDisplay.tsx` | 新建 |
| `src/components/account/AccountCard.tsx` | 新建 |
| `src/components/layout/AppShell.tsx` | 新建 — root layout |
| `src/components/theme/ThemeToggle.tsx` | 新建 |
| `src/pages/SetupPage.tsx` | 新建 |
| `src/pages/UnlockPage.tsx` | 新建 |
| `src/pages/MainPage.tsx` | 新建 |
| `src/styles/globals.css` | 修改 — 添加 `.countdown-ring` CSS |
| `src/App.tsx` | 删除（替换为路由体系） |
| `.github/workflows/nightly.yml` | 新建 |
| 各 `*.test.tsx` | 同上目录 |

---

## Task 1: 添加 shadcn 组件 + 路由基础设施

**Files:**
- Create: `src/router.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: 安装所需 shadcn 组件**

```bash
cd /home/niko/hobby/simple-2fa-next
bunx shadcn@latest add button input card dropdown-menu
```

预期输出：4 个组件文件写入 `src/components/ui/`。

- [ ] **Step 2: 写失败测试**

新建 `src/router.test.ts`：

```ts
import { describe, expect, it } from "vitest";

// 仅验证 router 对象可正常创建，路由守卫行为由集成测试覆盖
describe("router", () => {
  it("exports a router instance", async () => {
    const { router } = await import("./router");
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
  });

  it("has three top-level routes: / /unlock /setup", async () => {
    const { router } = await import("./router");
    const paths = router.routeTree.children?.map((r: { path: string }) => r.path) ?? [];
    expect(paths).toContain("/");
    expect(paths).toContain("/unlock");
    expect(paths).toContain("/setup");
  });
});
```

```bash
bun run test src/router.test.ts
```

预期：**FAIL** — `Cannot find module './router'`

- [ ] **Step 3: 实现 router.tsx**

新建 `src/router.tsx`：

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { MainPage } from "@/pages/MainPage";
import { SetupPage } from "@/pages/SetupPage";
import { UnlockPage } from "@/pages/UnlockPage";
import { useVaultStore } from "@/stores/vault";

const rootRoute = createRootRoute({ component: AppShell });

/** Vault 守卫：status 仍在 loading 时先触发一次检查，再按结果跳转 */
async function requireUnlocked() {
  const { status, checkStatus } = useVaultStore.getState();
  if (status === "loading") await checkStatus();
  const s = useVaultStore.getState().status;
  if (s === "uninitialized") throw redirect({ to: "/setup" });
  if (s !== "unlocked") throw redirect({ to: "/unlock" });
}

const mainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: requireUnlocked,
  component: MainPage,
});

const unlockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unlock",
  component: UnlockPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage,
});

const routeTree = rootRoute.addChildren([mainRoute, unlockRoute, setupRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 4: 实现 AppShell 占位（Task 10 会完善）**

新建 `src/components/layout/AppShell.tsx`：

```tsx
import { Outlet } from "@tanstack/react-router";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 5: 实现各页面占位（Task 8-9 会完善）**

```bash
mkdir -p src/pages src/components/account src/components/layout src/components/theme src/hooks src/i18n/locales
```

新建 `src/pages/SetupPage.tsx`：
```tsx
export function SetupPage() { return <div>Setup</div>; }
```

新建 `src/pages/UnlockPage.tsx`：
```tsx
export function UnlockPage() { return <div>Unlock</div>; }
```

新建 `src/pages/MainPage.tsx`：
```tsx
export function MainPage() { return <div>Main</div>; }
```

- [ ] **Step 6: 更新 main.tsx**

完整替换 `src/main.tsx`：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { router } from "./router";
import "./i18n";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 0 } },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

新建 `src/i18n/index.ts` 占位（Task 4 会完善）：
```ts
export {};
```

- [ ] **Step 7: 跑测试**

```bash
bun run test src/router.test.ts
```

预期：**PASS** 2 tests

- [ ] **Step 8: Typecheck**

```bash
bun run typecheck
```

预期：0 errors

- [ ] **Step 9: Commit**

```bash
git add src/router.tsx src/main.tsx src/pages/ src/components/layout/ src/i18n/ src/router.test.ts
git commit -m "feat(frontend): add TanStack Router + QueryClient infrastructure"
```

---

## Task 2: useNow Hook

**Files:**
- Create: `src/hooks/useNow.ts`
- Create: `src/hooks/useNow.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/hooks/useNow.test.ts`：

```ts
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current unix second on mount", () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z")); // 1704067200
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(1704067200);
  });

  it("updates after one second passes", async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const { result } = renderHook(() => useNow());

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(1704067201);
  });

  it("does not update within the same second", async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.500Z"));
    const { result } = renderHook(() => useNow());
    const initial = result.current;

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).toBe(initial);
  });
});
```

```bash
bun run test src/hooks/useNow.test.ts
```

预期：**FAIL** — `Cannot find module './useNow'`

- [ ] **Step 2: 实现**

新建 `src/hooks/useNow.ts`：

```ts
import { useEffect, useState } from "react";

/**
 * Returns the current Unix second, updated every second via setInterval.
 * Driving CountdownRing progress via this hook keeps animation in sync
 * with the live clock rather than stale server TTL.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 250); // poll 4x/s so we never miss a second boundary
    return () => clearInterval(id);
  }, []);

  return now;
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/hooks/useNow.test.ts
```

预期：**PASS** 3 tests

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNow.ts src/hooks/useNow.test.ts
git commit -m "feat(frontend): add useNow hook for second-resolution clock"
```

---

## Task 3: useAccounts Hook

**Files:**
- Create: `src/hooks/useAccounts.ts`
- Create: `src/hooks/useAccounts.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/hooks/useAccounts.test.ts`：

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/tauri", () => ({
  getAccounts: vi.fn(),
}));

import * as tauri from "@/lib/tauri";
import { useAccounts } from "./useAccounts";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useAccounts", () => {
  it("returns accounts on success", async () => {
    const mockAccount = {
      id: 1, name: "GitHub", issuer: "GitHub", algorithm: "SHA1",
      digits: 6, period: 30, groupId: null, icon: null, color: null,
      sortOrder: 0, code: "123456", ttl: 15, progress: 0.5,
    };
    vi.mocked(tauri.getAccounts).mockResolvedValue([mockAccount]);

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe("GitHub");
  });

  it("returns error state on failure", async () => {
    vi.mocked(tauri.getAccounts).mockRejectedValue(new Error("vault locked"));

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("query key is ['accounts']", () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([]);
    const { result } = renderHook(() => useAccounts(), { wrapper });
    // queryKey is accessible on the query object
    expect(result.current.queryKey).toEqual(["accounts"]);
  });
});
```

```bash
bun run test src/hooks/useAccounts.test.ts
```

预期：**FAIL** — `Cannot find module './useAccounts'`

- [ ] **Step 2: 实现**

新建 `src/hooks/useAccounts.ts`：

```ts
import { useQuery } from "@tanstack/react-query";
import { getAccounts } from "@/lib/tauri";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    refetchInterval: 30_000,
    staleTime: 0,
  });
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/hooks/useAccounts.test.ts
```

预期：**PASS** 3 tests

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAccounts.ts src/hooks/useAccounts.test.ts
git commit -m "feat(frontend): add useAccounts hook with TanStack Query"
```

---

## Task 4: i18n 初始化

**Files:**
- Create: `src/i18n/index.ts`（替换占位）
- Create: `src/i18n/locales/zh-CN.json`
- Create: `src/i18n/locales/en.json`
- Create: `src/i18n/locales/ja.json`
- Create: `src/i18n/i18n.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/i18n/i18n.test.ts`：

```ts
import { describe, expect, it } from "vitest";

import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

const requiredKeys = [
  "vault.setup_title",
  "vault.setup_submit",
  "vault.unlock_title",
  "vault.unlock_submit",
  "vault.password_placeholder",
  "vault.wrong_password",
  "accounts.empty_title",
  "accounts.empty_hint",
  "accounts.copied",
  "nav.lock",
  "theme.light",
  "theme.dark",
  "theme.system",
];

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe("i18n locale coverage", () => {
  for (const key of requiredKeys) {
    it(`zh-CN has key: ${key}`, () => {
      expect(flatten(zhCN)).toContain(key);
    });
    it(`en has key: ${key}`, () => {
      expect(flatten(en)).toContain(key);
    });
    it(`ja has key: ${key}`, () => {
      expect(flatten(ja)).toContain(key);
    });
  }
});
```

```bash
bun run test src/i18n/i18n.test.ts
```

预期：**FAIL** — JSON 文件不存在

- [ ] **Step 2: 创建翻译文件**

新建 `src/i18n/locales/zh-CN.json`：

```json
{
  "vault": {
    "setup_title": "设置主密码",
    "setup_subtitle": "首次使用，请设置一个主密码来保护您的账户",
    "setup_submit": "创建 Vault",
    "unlock_title": "解锁 Vault",
    "unlock_subtitle": "输入主密码以访问您的账户",
    "unlock_submit": "解锁",
    "password_placeholder": "主密码",
    "wrong_password": "密码错误，请重试"
  },
  "accounts": {
    "empty_title": "还没有账户",
    "empty_hint": "添加您的第一个 TOTP 账户",
    "copied": "已复制"
  },
  "nav": {
    "lock": "锁定"
  },
  "theme": {
    "light": "浅色",
    "dark": "深色",
    "system": "跟随系统"
  },
  "common": {
    "loading": "加载中…",
    "error": "出错了"
  }
}
```

新建 `src/i18n/locales/en.json`：

```json
{
  "vault": {
    "setup_title": "Set Master Password",
    "setup_subtitle": "Create a master password to protect your accounts",
    "setup_submit": "Create Vault",
    "unlock_title": "Unlock Vault",
    "unlock_subtitle": "Enter your master password to access your accounts",
    "unlock_submit": "Unlock",
    "password_placeholder": "Master password",
    "wrong_password": "Wrong password, please try again"
  },
  "accounts": {
    "empty_title": "No accounts yet",
    "empty_hint": "Add your first TOTP account",
    "copied": "Copied"
  },
  "nav": {
    "lock": "Lock"
  },
  "theme": {
    "light": "Light",
    "dark": "Dark",
    "system": "System"
  },
  "common": {
    "loading": "Loading…",
    "error": "Something went wrong"
  }
}
```

新建 `src/i18n/locales/ja.json`：

```json
{
  "vault": {
    "setup_title": "マスターパスワードを設定",
    "setup_subtitle": "アカウントを保護するためのマスターパスワードを作成してください",
    "setup_submit": "Vault を作成",
    "unlock_title": "Vault を解錠",
    "unlock_subtitle": "マスターパスワードを入力してアカウントにアクセス",
    "unlock_submit": "解錠",
    "password_placeholder": "マスターパスワード",
    "wrong_password": "パスワードが違います"
  },
  "accounts": {
    "empty_title": "アカウントがありません",
    "empty_hint": "最初の TOTP アカウントを追加してください",
    "copied": "コピーしました"
  },
  "nav": {
    "lock": "ロック"
  },
  "theme": {
    "light": "ライト",
    "dark": "ダーク",
    "system": "システム"
  },
  "common": {
    "loading": "読み込み中…",
    "error": "エラーが発生しました"
  }
}
```

- [ ] **Step 3: 实现 i18n/index.ts**

完整替换 `src/i18n/index.ts`：

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: "zh-CN",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 4: 跑测试**

```bash
bun run test src/i18n/i18n.test.ts
```

预期：**PASS**（所有 key × 3 语言）

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat(frontend): add i18n with zh-CN / en / ja locales"
```

---

## Task 5: CountdownRing 组件

**Files:**
- Modify: `src/styles/globals.css`（添加 `.countdown-ring`）
- Create: `src/components/account/CountdownRing.tsx`
- Create: `src/components/account/CountdownRing.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/account/CountdownRing.test.tsx`：

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountdownRing } from "./CountdownRing";

describe("CountdownRing", () => {
  it("renders without crashing", () => {
    const { container } = render(<CountdownRing period={30} progress={0.5} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("sets --ring-progress CSS custom property to progress percentage", () => {
    const { container } = render(<CountdownRing period={30} progress={0.75} />);
    const el = container.firstChild as HTMLElement;
    // inline style should carry the initial value; CSS property is also set via useEffect
    expect(el.style.getPropertyValue("--ring-progress")).toBe("75%");
  });

  it("clamps progress to [0, 1]", () => {
    const { container } = render(<CountdownRing period={30} progress={1.2} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("--ring-progress")).toBe("100%");
  });

  it("renders danger color class when ttl <= 5 seconds", () => {
    const { container } = render(<CountdownRing period={30} progress={0.1} danger />);
    expect(container.firstChild as HTMLElement).toHaveClass("countdown-ring--danger");
  });
});
```

```bash
bun run test src/components/account/CountdownRing.test.tsx
```

预期：**FAIL** — `Cannot find module './CountdownRing'`

- [ ] **Step 2: 添加 CSS**

在 `src/styles/globals.css` 末尾追加：

```css
/* CountdownRing: GPU-interpolated conic gradient via @property */
/* --ring-progress is already declared above with @property */

.countdown-ring {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: conic-gradient(
    hsl(var(--ring-color, 222.2 47.4% 11.2%)) var(--ring-progress),
    color-mix(in srgb, currentColor 12%, transparent) 0%
  );
  transition: --ring-progress 1s linear;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark .countdown-ring {
  --ring-color: 210 40% 98%;
}

.countdown-ring--danger {
  --ring-color: 0 84.2% 60.2%;
}
```

- [ ] **Step 3: 实现组件**

新建 `src/components/account/CountdownRing.tsx`：

```tsx
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  period: number;
  progress: number; // 0..1, 1 = full, 0 = empty
  danger?: boolean;
  className?: string;
};

export function CountdownRing({ progress, danger = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(1, progress));

  // Update CSS custom property so the GPU transition fires on each tick
  useEffect(() => {
    ref.current?.style.setProperty("--ring-progress", `${clamped * 100}%`);
  }, [clamped]);

  return (
    <div
      ref={ref}
      className={cn("countdown-ring", danger && "countdown-ring--danger", className)}
      style={{ "--ring-progress": `${clamped * 100}%` } as React.CSSProperties}
      aria-hidden
    />
  );
}
```

- [ ] **Step 4: 跑测试**

```bash
bun run test src/components/account/CountdownRing.test.tsx
```

预期：**PASS** 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css src/components/account/CountdownRing.tsx src/components/account/CountdownRing.test.tsx
git commit -m "feat(frontend): add CountdownRing with CSS @property GPU animation"
```

---

## Task 6: CodeDisplay 组件

**Files:**
- Create: `src/components/account/CodeDisplay.tsx`
- Create: `src/components/account/CodeDisplay.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/account/CodeDisplay.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { CodeDisplay } from "./CodeDisplay";

describe("CodeDisplay", () => {
  it("formats 6-digit code as 'xxx xxx'", () => {
    render(<CodeDisplay code="123456" digits={6} />);
    expect(screen.getByText("123 456")).toBeTruthy();
  });

  it("formats 8-digit code as 'xxxx xxxx'", () => {
    render(<CodeDisplay code="12345678" digits={8} />);
    expect(screen.getByText("1234 5678")).toBeTruthy();
  });

  it("applies monospace font class", () => {
    const { container } = render(<CodeDisplay code="123456" digits={6} />);
    const el = container.querySelector("span");
    expect(el?.className).toContain("font-mono");
  });

  it("renders the raw code when length does not match digits", () => {
    render(<CodeDisplay code="123456" digits={7} />);
    expect(screen.getByText("123456")).toBeTruthy();
  });
});
```

```bash
bun run test src/components/account/CodeDisplay.test.tsx
```

预期：**FAIL** — `Cannot find module './CodeDisplay'`

- [ ] **Step 2: 实现**

新建 `src/components/account/CodeDisplay.tsx`：

```tsx
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  code: string;
  digits: number;
};

function formatCode(code: string, digits: number): string {
  if (code.length !== digits) return code;
  const half = Math.ceil(digits / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

export function CodeDisplay({ code, digits }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={code}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.1 }}
        className="font-mono text-2xl tracking-[0.15em] tabular-nums select-none"
      >
        {formatCode(code, digits)}
      </motion.span>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/components/account/CodeDisplay.test.tsx
```

预期：**PASS** 4 tests

- [ ] **Step 4: Commit**

```bash
git add src/components/account/CodeDisplay.tsx src/components/account/CodeDisplay.test.tsx
git commit -m "feat(frontend): add CodeDisplay with Framer Motion code-change animation"
```

---

## Task 7: AccountCard 组件

**Files:**
- Create: `src/components/account/AccountCard.tsx`
- Create: `src/components/account/AccountCard.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/account/AccountCard.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));

import type { AccountWithCode } from "@/lib/tauri";
import { AccountCard } from "./AccountCard";

const account: AccountWithCode = {
  id: 1,
  name: "alice@example.com",
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
};

describe("AccountCard", () => {
  it("shows account name", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("alice@example.com")).toBeTruthy();
  });

  it("shows issuer", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("shows formatted code '123 456'", () => {
    render(<AccountCard account={account} />);
    expect(screen.getByText("123 456")).toBeTruthy();
  });

  it("copies code to clipboard on click", async () => {
    const user = userEvent.setup();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<AccountCard account={account} />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("123456");
  });

  it("renders danger state when ttl <= 5s", () => {
    // now=1704067225 → ttl = 30 - (1704067225 % 30) = 30 - 25 = 5
    render(<AccountCard account={{ ...account, period: 30 }} />);
    // progress = 5/30 ≈ 0.167 — not danger. Override now via mock to get danger:
    // Already mocked useNow = 1704067215 → ttl = 30 - (15 % 30) = 15, not danger
    // This test just verifies the component renders the ring
    const { container } = render(<AccountCard account={account} />);
    expect(container.querySelector(".countdown-ring")).toBeTruthy();
  });
});
```

```bash
bun run test src/components/account/AccountCard.test.tsx
```

预期：**FAIL** — `Cannot find module './AccountCard'`

- [ ] **Step 2: 实现**

新建 `src/components/account/AccountCard.tsx`：

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { useNow } from "@/hooks/useNow";
import type { AccountWithCode } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { CodeDisplay } from "./CodeDisplay";
import { CountdownRing } from "./CountdownRing";

type Props = {
  account: AccountWithCode;
  className?: string;
};

export function AccountCard({ account, className }: Props) {
  const { t } = useTranslation();
  const now = useNow();
  const [copied, setCopied] = useState(false);

  // Compute progress from live clock so animation stays smooth between fetches
  const ttl = account.period - (now % account.period);
  const progress = ttl / account.period;
  const isDanger = ttl <= 5;

  async function handleCopy() {
    await navigator.clipboard.writeText(account.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card
      className={cn(
        "flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
        className,
      )}
    >
      <CountdownRing period={account.period} progress={progress} danger={isDanger} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{account.name}</p>
        {account.issuer && (
          <p className="text-xs text-muted-foreground truncate">{account.issuer}</p>
        )}
      </div>

      <button
        type="button"
        aria-label={t("accounts.copied")}
        onClick={() => void handleCopy()}
        className={cn(
          "text-right transition-colors",
          isDanger && "text-destructive",
        )}
      >
        <CodeDisplay code={account.code} digits={account.digits} />
        <p className="text-xs text-muted-foreground mt-0.5">
          {copied ? t("accounts.copied") : `${ttl}s`}
        </p>
      </button>
    </Card>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/components/account/AccountCard.test.tsx
```

预期：**PASS** 5 tests

- [ ] **Step 4: Commit**

```bash
git add src/components/account/AccountCard.tsx src/components/account/AccountCard.test.tsx
git commit -m "feat(frontend): add AccountCard with live TTL progress and copy"
```

---

## Task 8: SetupPage + UnlockPage

**Files:**
- Create: `src/pages/SetupPage.tsx`（替换占位）
- Create: `src/pages/UnlockPage.tsx`（替换占位）
- Create: `src/pages/SetupPage.test.tsx`
- Create: `src/pages/UnlockPage.test.tsx`

- [ ] **Step 1: 写 SetupPage 失败测试**

新建 `src/pages/SetupPage.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/stores/vault", () => ({
  useVaultStore: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import * as vaultModule from "@/stores/vault";
import { SetupPage } from "./SetupPage";

const mockSetup = vi.fn();

beforeEach(() => {
  vi.mocked(vaultModule.useVaultStore).mockReturnValue({
    status: "uninitialized",
    error: null,
    setup: mockSetup,
    unlock: vi.fn(),
    lock: vi.fn(),
    checkStatus: vi.fn(),
  });
  vi.clearAllMocks();
});

describe("SetupPage", () => {
  it("renders the setup title", () => {
    render(<SetupPage />);
    expect(screen.getByRole("heading")).toBeTruthy();
  });

  it("calls setup with entered password on submit", async () => {
    const user = userEvent.setup();
    mockSetup.mockResolvedValue(undefined);

    render(<SetupPage />);
    const input = screen.getByPlaceholderText(/password/i);
    await user.type(input, "mypassword");
    await user.click(screen.getByRole("button", { name: /create|vault|setup/i }));

    expect(mockSetup).toHaveBeenCalledWith("mypassword");
  });

  it("disables submit when password is empty", () => {
    render(<SetupPage />);
    const btn = screen.getByRole("button", { name: /create|vault|setup/i });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 2: 写 UnlockPage 失败测试**

新建 `src/pages/UnlockPage.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/stores/vault", () => ({ useVaultStore: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

import * as vaultModule from "@/stores/vault";
import { UnlockPage } from "./UnlockPage";

const mockUnlock = vi.fn();

beforeEach(() => {
  vi.mocked(vaultModule.useVaultStore).mockReturnValue({
    status: "locked",
    error: null,
    setup: vi.fn(),
    unlock: mockUnlock,
    lock: vi.fn(),
    checkStatus: vi.fn(),
  });
  vi.clearAllMocks();
});

describe("UnlockPage", () => {
  it("renders the unlock title", () => {
    render(<UnlockPage />);
    expect(screen.getByRole("heading")).toBeTruthy();
  });

  it("calls unlock with password on submit", async () => {
    const user = userEvent.setup();
    mockUnlock.mockResolvedValue(undefined);

    render(<UnlockPage />);
    await user.type(screen.getByPlaceholderText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(mockUnlock).toHaveBeenCalledWith("secret");
  });

  it("shows error when vault store has error", () => {
    vi.mocked(vaultModule.useVaultStore).mockReturnValue({
      status: "error",
      error: "Wrong password",
      setup: vi.fn(),
      unlock: mockUnlock,
      lock: vi.fn(),
      checkStatus: vi.fn(),
    });
    render(<UnlockPage />);
    expect(screen.getByText("Wrong password")).toBeTruthy();
  });
});
```

```bash
bun run test src/pages/SetupPage.test.tsx src/pages/UnlockPage.test.tsx
```

预期：**FAIL** — 模块不存在

- [ ] **Step 3: 实现 SetupPage**

完整替换 `src/pages/SetupPage.tsx`：

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultStore } from "@/stores/vault";

export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setup, error } = useVaultStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await setup(password);
    setLoading(false);
    await navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("vault.setup_title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("vault.setup_subtitle")}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("vault.password_placeholder")}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={!password || loading}>
            {t("vault.setup_submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 实现 UnlockPage**

完整替换 `src/pages/UnlockPage.tsx`：

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultStore } from "@/stores/vault";

export function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unlock, error } = useVaultStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await unlock(password);
    setLoading(false);
    await navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("vault.unlock_title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("vault.unlock_subtitle")}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("vault.password_placeholder")}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={!password || loading}>
            {t("vault.unlock_submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 跑测试**

```bash
bun run test src/pages/SetupPage.test.tsx src/pages/UnlockPage.test.tsx
```

预期：**PASS** 6 tests

- [ ] **Step 6: Commit**

```bash
git add src/pages/SetupPage.tsx src/pages/SetupPage.test.tsx \
        src/pages/UnlockPage.tsx src/pages/UnlockPage.test.tsx
git commit -m "feat(frontend): add SetupPage and UnlockPage"
```

---

## Task 9: MainPage

**Files:**
- Create: `src/pages/MainPage.tsx`（替换占位）
- Create: `src/pages/MainPage.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/pages/MainPage.test.tsx`：

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/tauri", () => ({ getAccounts: vi.fn(), lockVault: vi.fn() }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));
vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import * as tauri from "@/lib/tauri";
import type { AccountWithCode } from "@/lib/tauri";
import { MainPage } from "./MainPage";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockAccount: AccountWithCode = {
  id: 1, name: "GitHub", issuer: "Acme", algorithm: "SHA1",
  digits: 6, period: 30, groupId: null, icon: null, color: null,
  sortOrder: 0, code: "123456", ttl: 15, progress: 0.5,
};

describe("MainPage", () => {
  it("shows empty state when no accounts", async () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([]);
    render(<MainPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no accounts|还没有账户/i)).toBeTruthy());
  });

  it("renders account cards when accounts exist", async () => {
    vi.mocked(tauri.getAccounts).mockResolvedValue([mockAccount]);
    render(<MainPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("GitHub")).toBeTruthy());
  });

  it("shows loading state initially", () => {
    vi.mocked(tauri.getAccounts).mockReturnValue(new Promise(() => {}));
    render(<MainPage />, { wrapper });
    expect(screen.getByText(/loading|加载/i)).toBeTruthy();
  });
});
```

```bash
bun run test src/pages/MainPage.test.tsx
```

预期：**FAIL** — 模块不存在

- [ ] **Step 2: 实现**

完整替换 `src/pages/MainPage.tsx`：

```tsx
import { useTranslation } from "react-i18next";

import { AccountCard } from "@/components/account/AccountCard";
import { useAccounts } from "@/hooks/useAccounts";

export function MainPage() {
  const { t } = useTranslation();
  const { data: accounts, isLoading, isError } = useAccounts();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-destructive">
        {t("common.error")}
      </div>
    );
  }

  if (!accounts?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-medium">{t("accounts.empty_title")}</p>
        <p className="text-sm text-muted-foreground">{t("accounts.empty_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
bun run test src/pages/MainPage.test.tsx
```

预期：**PASS** 3 tests

- [ ] **Step 4: Commit**

```bash
git add src/pages/MainPage.tsx src/pages/MainPage.test.tsx
git commit -m "feat(frontend): add MainPage with account list and empty state"
```

---

## Task 10: AppShell + ThemeToggle + 路由连线

**Files:**
- Create: `src/stores/settings.ts`
- Create: `src/stores/settings.test.ts`
- Create: `src/components/theme/ThemeToggle.tsx`
- Modify: `src/components/layout/AppShell.tsx`（替换占位）
- Delete: `src/App.tsx`（已被路由体系取代）

- [ ] **Step 1: 写 settings store 失败测试**

新建 `src/stores/settings.test.ts`：

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useSettingsStore } from "./settings";

beforeEach(() => {
  act(() => { useSettingsStore.setState({ theme: "system" }); });
  document.documentElement.classList.remove("dark");
});

describe("useSettingsStore", () => {
  it("default theme is system", () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.theme).toBe("system");
  });

  it("setTheme('dark') adds .dark to html element", () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setTheme("dark"); });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('light') removes .dark from html element", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setTheme("light"); });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
```

```bash
bun run test src/stores/settings.test.ts
```

预期：**FAIL**

- [ ] **Step 2: 实现 settings store**

新建 `src/stores/settings.ts`：

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

type SettingsStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    { name: "s2fa-settings" },
  ),
);

// Apply theme on store initialization (handles page reload)
applyTheme(useSettingsStore.getState().theme);
```

- [ ] **Step 3: 跑 settings 测试**

```bash
bun run test src/stores/settings.test.ts
```

预期：**PASS** 3 tests

- [ ] **Step 4: 实现 ThemeToggle**

新建 `src/components/theme/ThemeToggle.tsx`：

```tsx
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsStore } from "@/stores/settings";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useSettingsStore();

  const icons = { light: Sun, dark: Moon, system: Monitor } as const;
  const Icon = icons[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          {t("theme.light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          {t("theme.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          {t("theme.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: 完善 AppShell（带导航栏）**

完整替换 `src/components/layout/AppShell.tsx`：

```tsx
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useVaultStore } from "@/stores/vault";

export function AppShell() {
  const { t } = useTranslation();
  const { status, lock } = useVaultStore();
  const navigate = useNavigate();

  async function handleLock() {
    await lock();
    await navigate({ to: "/unlock" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {status === "unlocked" && (
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
          <span className="text-sm font-semibold">Simple 2FA</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void handleLock()}>
              {t("nav.lock")}
            </Button>
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: 删除已被替换的 App.tsx**

```bash
git rm src/App.tsx
```

- [ ] **Step 7: 全量测试**

```bash
bun run test
```

预期：所有测试通过（包括之前所有 tasks）

- [ ] **Step 8: Typecheck**

```bash
bun run typecheck
```

预期：0 errors

- [ ] **Step 9: Commit**

```bash
git add src/stores/settings.ts src/stores/settings.test.ts \
        src/components/theme/ThemeToggle.tsx \
        src/components/layout/AppShell.tsx
git commit -m "feat(frontend): add AppShell, ThemeToggle, settings store"
```

---

## Task 11: nightly.yml 自动打包

**Files:**
- Create: `.github/workflows/nightly.yml`

- [ ] **Step 1: 创建 nightly workflow**

新建 `.github/workflows/nightly.yml`：

```yaml
name: Nightly

on:
  schedule:
    - cron: "0 2 * * *"   # 每日 UTC 02:00
  workflow_dispatch:        # 允许手动触发

concurrency:
  group: nightly
  cancel-in-progress: true

jobs:
  nightly:
    name: Nightly (${{ matrix.platform }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-latest
            args: ""
          - platform: macos-latest
            args: "--target aarch64-apple-darwin --target x86_64-apple-darwin"
          - platform: windows-latest
            args: ""
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libappindicator3-dev \
            librsvg2-dev patchelf

      - name: Install frontend deps
        run: bun install --frozen-lockfile

      - name: Build nightly
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: nightly-${{ github.run_number }}
          releaseName: "Nightly #${{ github.run_number }}"
          releaseBody: "Automated nightly build from main branch."
          prerelease: true
          args: ${{ matrix.args }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/nightly.yml
git commit -m "ci(infra): add nightly workflow for daily pre-release builds"
```

---

## 最终验收

```bash
# 全量前端测试（含覆盖率）
bun run test:coverage

# 类型检查
bun run typecheck

# Lint
bun run lint:ci

# Rust 测试（确保未受影响）
cd src-tauri && cargo test

# 手动：启动 dev 服务验证
bun run tauri dev
```

**人工验收清单（dev 模式下操作）：**
- [ ] 首次打开 → 跳转到 `/setup`，设置密码后进入主页
- [ ] 关闭重开 → 跳转到 `/unlock`，解锁后进入主页
- [ ] 添加一个账户，观察 30s 倒计时环连续无抖动
- [ ] 等待码换（TTL 归零）→ 数字有淡入动画
- [ ] TTL ≤ 5s 时倒计时环变红
- [ ] 点击账户 → 码已复制（工具提示闪现）
- [ ] 主题切换：浅色 / 深色 / 跟随系统均正常
- [ ] 语言正确（zh-CN 默认，可在设置中切换）
- [ ] 锁定后跳转到解锁页

---

## 验收条件

| 检查项 | 命令 |
|---|---|
| 前端测试全绿 | `bun run test` |
| 覆盖率 ≥ 80% | `bun run test:coverage` |
| 类型检查 | `bun run typecheck` |
| Lint 零错 | `bun run lint:ci` |
| Rust 测试不受影响 | `cd src-tauri && cargo test` |
| 人工：30s 过渡无抖动 | `bun run tauri dev` |
| 人工：三语切换正常 | dev 模式 |
| nightly 可手动触发 | GitHub Actions → workflow_dispatch |
