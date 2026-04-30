# Screen QR Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "扫描屏幕" button in `AddAccountDialog` that captures a monitor via `getDisplayMedia`, auto-decodes any QR code with jsQR, and presents a confirmation dialog before adding the account.

**Architecture:** A `screenCapture.ts` utility wraps the browser video/canvas API (isolated for testability). A `useScreenScan` hook composes that utility with jsQR and the existing `parseOtpauthUri` Tauri command. `ScanConfirmDialog` previews the parsed account. `AddAccountDialog` wires everything together.

**Tech Stack:** jsqr (QR decode), `getDisplayMedia` Web API, Vitest + @testing-library/react

## Post-review hardening applied

- [x] Stop display-media tracks on successful capture, playback failure, frame-capture failure, and metadata timeout.
- [x] Disable screen scanning when `getDisplayMedia` is unavailable and expose localized unsupported copy.
- [x] Reset scan state when the add-account dialog closes.
- [x] Avoid stacked modal traps by hiding the add-account dialog while scan confirmation is open.
- [x] Show confirmation errors when adding a scanned account fails instead of dropping the rejected promise.
- [x] Validate scanned/imported TOTP algorithm, digits, and period before adding an account.
- [x] Add focused tests for cleanup, unsupported capture, confirmation failure, and invalid otpauth parameters.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/screenCapture.ts` | Wraps `getDisplayMedia` + canvas frame capture → `ImageData` |
| Create | `src/lib/screenCapture.test.ts` | Unit tests for capture utility |
| Create | `src/hooks/useScreenScan.ts` | State machine: idle → scanning → found/not_found/error |
| Create | `src/hooks/useScreenScan.test.ts` | Hook tests (mocks screenCapture + jsQR + tauri) |
| Create | `src/components/account/ScanConfirmDialog.tsx` | Confirmation dialog showing parsed account info |
| Create | `src/components/account/ScanConfirmDialog.test.tsx` | Dialog render + callback tests |
| Modify | `src/components/account/AddAccountDialog.tsx` | Add scan button, render ScanConfirmDialog |
| Modify | `src/components/account/AddAccountDialog.test.tsx` | Test scan button presence |
| Modify | `src/i18n/locales/zh-CN.json` | Add `scan.*` keys |
| Modify | `src/i18n/locales/en.json` | Add `scan.*` keys |
| Modify | `src/i18n/locales/ja.json` | Add `scan.*` keys |

---

## Task 1: Install jsqr and add i18n keys

**Files:**
- Modify: `package.json` (via bun add)
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ja.json`

- [ ] **Step 1: Install jsqr**

```bash
bun add jsqr
```

Expected: `jsqr` appears in `package.json` dependencies.

- [ ] **Step 2: Add scan i18n keys to zh-CN.json**

Add the `"scan"` block before the closing `}` of the JSON (after `"common"` block):

```json
  "scan": {
    "scan_screen": "扫描屏幕",
    "confirm_title": "确认添加账户",
    "confirm_add": "添加",
    "not_found": "未检测到有效 QR 码",
    "retry": "重试",
    "scanning": "正在扫描…"
  }
```

- [ ] **Step 3: Add scan i18n keys to en.json**

```json
  "scan": {
    "scan_screen": "Scan Screen",
    "confirm_title": "Confirm Add Account",
    "confirm_add": "Add",
    "not_found": "No valid QR code detected",
    "retry": "Retry",
    "scanning": "Scanning…"
  }
```

- [ ] **Step 4: Add scan i18n keys to ja.json**

```json
  "scan": {
    "scan_screen": "画面をスキャン",
    "confirm_title": "アカウントを追加",
    "confirm_add": "追加",
    "not_found": "有効な QR コードが見つかりません",
    "retry": "再試行",
    "scanning": "スキャン中…"
  }
```

- [ ] **Step 5: Type-check**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/i18n/locales/
git commit -m "feat(deps): add jsqr; add scan i18n keys"
```

---

## Task 2: screenCapture utility (TDD)

**Files:**
- Create: `src/lib/screenCapture.ts`
- Create: `src/lib/screenCapture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/screenCapture.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureScreenFrame } from "@/lib/screenCapture";

describe("captureScreenFrame", () => {
  let mockTrack: { stop: ReturnType<typeof vi.fn> };
  let mockStream: MediaStream;

  beforeEach(() => {
    mockTrack = { stop: vi.fn() };
    mockStream = {
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(
        new ImageData(new Uint8ClampedArray(4), 1, 1),
      ),
    });

    // Mock video play and dimensions
    Object.defineProperty(HTMLVideoElement.prototype, "play", {
      value: vi.fn().mockImplementation(function (this: HTMLVideoElement) {
        Object.defineProperty(this, "videoWidth", { value: 100, configurable: true });
        Object.defineProperty(this, "videoHeight", { value: 100, configurable: true });
        setTimeout(() => this.dispatchEvent(new Event("loadedmetadata")), 0);
        return Promise.resolve();
      }),
      configurable: true,
    });
  });

  it("returns ImageData from the stream", async () => {
    const result = await captureScreenFrame(mockStream);
    expect(result).toBeInstanceOf(ImageData);
  });

  it("stops all tracks after capture", async () => {
    await captureScreenFrame(mockStream);
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/lib/screenCapture.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/screenCapture'`

- [ ] **Step 3: Implement screenCapture.ts**

Create `src/lib/screenCapture.ts`:

```typescript
export async function captureScreenFrame(stream: MediaStream): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.srcObject = stream;

    video.addEventListener("loadedmetadata", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        stream.getTracks().forEach((t) => t.stop());
        reject(new Error("canvas 2d context unavailable"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      resolve(imageData);
    });

    video.play().catch(reject);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test src/lib/screenCapture.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenCapture.ts src/lib/screenCapture.test.ts
git commit -m "feat(frontend): add screenCapture utility"
```

---

## Task 3: useScreenScan hook (TDD)

**Files:**
- Create: `src/hooks/useScreenScan.ts`
- Create: `src/hooks/useScreenScan.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useScreenScan.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsqr");
vi.mock("@/lib/screenCapture");
vi.mock("@/lib/tauri", () => ({
  parseOtpauthUri: vi.fn(),
}));

import jsQR from "jsqr";
import { captureScreenFrame } from "@/lib/screenCapture";
import { parseOtpauthUri } from "@/lib/tauri";
import { useScreenScan } from "@/hooks/useScreenScan";

const MOCK_IMAGE_DATA = new ImageData(new Uint8ClampedArray(4), 1, 1);
const MOCK_ITEM = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
};

describe("useScreenScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockTrack = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue({
          getTracks: () => [mockTrack],
        }),
      },
      configurable: true,
    });

    vi.mocked(captureScreenFrame).mockResolvedValue(MOCK_IMAGE_DATA);
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useScreenScan());
    expect(result.current.result.status).toBe("idle");
  });

  it("transitions to not_found when jsQR returns null", async () => {
    vi.mocked(jsQR).mockReturnValue(null);
    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });
    expect(result.current.result.status).toBe("not_found");
  });

  it("transitions to found when QR decoded successfully", async () => {
    vi.mocked(jsQR).mockReturnValue({
      data: "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
    } as ReturnType<typeof jsQR>);
    vi.mocked(parseOtpauthUri).mockResolvedValue(MOCK_ITEM);

    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });

    expect(result.current.result.status).toBe("found");
    if (result.current.result.status === "found") {
      expect(result.current.result.item).toEqual(MOCK_ITEM);
    }
  });

  it("stays idle when user cancels (AbortError)", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValue(err);

    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });
    expect(result.current.result.status).toBe("idle");
  });

  it("stays idle when user cancels (NotAllowedError)", async () => {
    const err = Object.assign(new Error("not allowed"), { name: "NotAllowedError" });
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValue(err);

    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });
    expect(result.current.result.status).toBe("idle");
  });

  it("transitions to error on unexpected failure", async () => {
    vi.mocked(captureScreenFrame).mockRejectedValue(
      Object.assign(new Error("canvas fail"), { name: "Error" }),
    );
    vi.mocked(jsQR).mockReturnValue(null);

    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });
    expect(result.current.result.status).toBe("error");
  });

  it("reset returns to idle from not_found", async () => {
    vi.mocked(jsQR).mockReturnValue(null);
    const { result } = renderHook(() => useScreenScan());
    await act(async () => { await result.current.scan(); });
    expect(result.current.result.status).toBe("not_found");
    act(() => { result.current.reset(); });
    expect(result.current.result.status).toBe("idle");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/hooks/useScreenScan.test.ts
```

Expected: FAIL — `Cannot find module '@/hooks/useScreenScan'`

- [ ] **Step 3: Implement useScreenScan.ts**

Create `src/hooks/useScreenScan.ts`:

```typescript
import jsQR from "jsqr";
import { useState } from "react";

import { captureScreenFrame } from "@/lib/screenCapture";
import { parseOtpauthUri, type ImportAccountItem } from "@/lib/tauri";

type ScreenScanResult =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "found"; item: ImportAccountItem }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function useScreenScan() {
  const [result, setResult] = useState<ScreenScanResult>({ status: "idle" });

  async function scan() {
    setResult({ status: "scanning" });
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const imageData = await captureScreenFrame(stream);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (!code) {
        setResult({ status: "not_found" });
        return;
      }

      const item = await parseOtpauthUri(code.data);
      setResult({ status: "found", item });
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.name === "NotAllowedError")) {
        setResult({ status: "idle" });
        return;
      }
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      setResult({ status: "error", message });
    }
  }

  function reset() {
    setResult({ status: "idle" });
  }

  return { result, scan, reset };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/hooks/useScreenScan.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScreenScan.ts src/hooks/useScreenScan.test.ts
git commit -m "feat(frontend): add useScreenScan hook"
```

---

## Task 4: ScanConfirmDialog component (TDD)

**Files:**
- Create: `src/components/account/ScanConfirmDialog.tsx`
- Create: `src/components/account/ScanConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/account/ScanConfirmDialog.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ScanConfirmDialog } from "@/components/account/ScanConfirmDialog";

const ITEM = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
};

describe("ScanConfirmDialog", () => {
  it("renders nothing when item is null", () => {
    const { container } = render(
      <ScanConfirmDialog item={null} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows issuer and name when item is provided", () => {
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("calls onConfirm with item when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /添加|Add|追加/i }));
    expect(onConfirm).toHaveBeenCalledWith(ITEM);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ScanConfirmDialog item={ITEM} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /取消|Cancel|キャンセル/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/components/account/ScanConfirmDialog.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/account/ScanConfirmDialog'`

- [ ] **Step 3: Implement ScanConfirmDialog.tsx**

Create `src/components/account/ScanConfirmDialog.tsx`:

```typescript
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportAccountItem } from "@/lib/tauri";

type Props = {
  item: ImportAccountItem | null;
  onConfirm: (item: ImportAccountItem) => void;
  onCancel: () => void;
};

export function ScanConfirmDialog({ item, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("scan.confirm_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {item.issuer && (
            <p>
              <span className="font-medium">{t("accounts.issuer_label")}: </span>
              {item.issuer}
            </p>
          )}
          <p>
            <span className="font-medium">{t("accounts.name_label")}: </span>
            {item.name}
          </p>
          <p>
            <span className="font-medium">{t("accounts.algorithm_label")}: </span>
            {item.algorithm}
          </p>
          <p>
            <span className="font-medium">{t("accounts.digits_label")}: </span>
            {item.digits}
          </p>
          <p>
            <span className="font-medium">{t("accounts.period_label")}: </span>
            {item.period}s
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("accounts.cancel")}
          </Button>
          <Button type="button" onClick={() => onConfirm(item)}>
            {t("scan.confirm_add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/components/account/ScanConfirmDialog.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/account/ScanConfirmDialog.tsx src/components/account/ScanConfirmDialog.test.tsx
git commit -m "feat(frontend): add ScanConfirmDialog component"
```

---

## Task 5: Wire into AddAccountDialog (TDD)

**Files:**
- Modify: `src/components/account/AddAccountDialog.tsx`
- Modify: `src/components/account/AddAccountDialog.test.tsx`

- [ ] **Step 1: Add failing test for scan button**

Open `src/components/account/AddAccountDialog.test.tsx` and add at the end of the `describe` block:

```typescript
it("renders the scan screen button", () => {
  render(<AddAccountDialog open onClose={vi.fn()} />);
  expect(
    screen.getByRole("button", { name: /扫描屏幕|Scan Screen|画面をスキャン/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/components/account/AddAccountDialog.test.tsx
```

Expected: the new test FAILS, all existing tests still PASS.

- [ ] **Step 3: Modify AddAccountDialog.tsx**

Replace the imports section and add scan wiring. Full updated file:

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ScanConfirmDialog } from "@/components/account/ScanConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScreenScan } from "@/hooks/useScreenScan";
import { addAccount, type ImportAccountItem } from "@/lib/tauri";

const BASE32_RE = /^[A-Z2-7]+=*$/i;

const schema = z.object({
  name: z.string().min(1, "name_required"),
  issuer: z.string().optional(),
  secret: z
    .string()
    .min(1, "secret_required")
    .refine((v) => BASE32_RE.test(v.replace(/\s/g, "")), "secret_invalid"),
  algorithm: z.enum(["SHA1", "SHA256", "SHA512"]),
  digits: z.coerce.number().int().min(6).max(8),
  period: z.coerce.number().int().min(15).max(300),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { result: scanResult, scan, reset: resetScan } = useScreenScan();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      issuer: "",
      secret: "",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const [submitError, setSubmitError] = useState<string | null>(null);

  function messageFor(errorMessage: unknown) {
    if (typeof errorMessage !== "string") return "";
    return t(`accounts.${errorMessage}`);
  }

  async function onSubmit(values: FormOutput) {
    setSubmitError(null);
    try {
      await addAccount({
        ...values,
        issuer: values.issuer?.trim() || undefined,
        secret: values.secret.replace(/\s/g, "").toUpperCase(),
      });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      form.reset();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleScanConfirm(item: ImportAccountItem) {
    await addAccount({
      name: item.name,
      issuer: item.issuer,
      secret: item.secret,
      algorithm: item.algorithm,
      digits: item.digits,
      period: item.period,
    });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    resetScan();
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("accounts.add")}</DialogTitle>
          </DialogHeader>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            aria-label={t("scan.scan_screen")}
            disabled={scanResult.status === "scanning"}
            onClick={() => void scan()}
          >
            <ScanLine className="mr-2 size-4" />
            {scanResult.status === "scanning"
              ? t("scan.scanning")
              : t("scan.scan_screen")}
          </Button>

          {scanResult.status === "not_found" && (
            <p className="text-center text-sm text-destructive">
              {t("scan.not_found")}
              <Button
                type="button"
                variant="link"
                className="ml-1 h-auto p-0 text-sm"
                onClick={() => void scan()}
              >
                {t("scan.retry")}
              </Button>
            </p>
          )}

          {scanResult.status === "error" && (
            <p className="text-center text-sm text-destructive">
              {scanResult.message}
            </p>
          )}

          <div className="relative flex items-center gap-2 py-1">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">
              {t("common.or") ?? "or"}
            </span>
            <div className="flex-1 border-t" />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">{t("accounts.name_label")}</Label>
              <Input
                id="add-name"
                aria-label={t("accounts.name_label")}
                placeholder={t("accounts.name_placeholder")}
                {...form.register("name")}
              />
              {form.formState.errors.name?.message && (
                <p className="text-sm text-destructive">
                  {messageFor(form.formState.errors.name.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-issuer">{t("accounts.issuer_label")}</Label>
              <Input
                id="add-issuer"
                aria-label={t("accounts.issuer_label")}
                placeholder={t("accounts.issuer_placeholder")}
                {...form.register("issuer")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-secret">{t("accounts.secret_label")}</Label>
              <Input
                id="add-secret"
                aria-label={t("accounts.secret_label")}
                placeholder={t("accounts.secret_placeholder")}
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="characters"
                {...form.register("secret")}
              />
              {form.formState.errors.secret?.message && (
                <p className="text-sm text-destructive">
                  {messageFor(form.formState.errors.secret.message)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-algorithm">{t("accounts.algorithm_label")}</Label>
                <Controller
                  control={form.control}
                  name="algorithm"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="add-algorithm" aria-label={t("accounts.algorithm_label")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SHA1">SHA1</SelectItem>
                        <SelectItem value="SHA256">SHA256</SelectItem>
                        <SelectItem value="SHA512">SHA512</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-digits">{t("accounts.digits_label")}</Label>
                <Controller
                  control={form.control}
                  name="digits"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id="add-digits" aria-label={t("accounts.digits_label")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="7">7</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-period">{t("accounts.period_label")}</Label>
                <Input
                  id="add-period"
                  aria-label={t("accounts.period_label")}
                  type="number"
                  {...form.register("period", { valueAsNumber: true })}
                />
              </div>
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-add-account"
                onClick={onClose}
              >
                {t("accounts.cancel")}
              </Button>
              <Button
                type="submit"
                data-testid="submit-add-account"
                disabled={!isValid || isSubmitting}
              >
                {t("accounts.add")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ScanConfirmDialog
        item={scanResult.status === "found" ? scanResult.item : null}
        onConfirm={(item) => void handleScanConfirm(item)}
        onCancel={resetScan}
      />
    </>
  );
}
```

- [ ] **Step 4: Add `common.or` i18n key** (used for the divider)

In all three locale files, add to the `"common"` block:

`zh-CN.json`: `"or": "或"`  
`en.json`: `"or": "or"`  
`ja.json`: `"or": "または"`

- [ ] **Step 5: Run all AddAccountDialog tests**

```bash
bun run test src/components/account/AddAccountDialog.test.tsx
```

Expected: all tests PASS including the new scan button test.

- [ ] **Step 6: Run full test suite**

```bash
bun run test
```

Expected: all tests PASS.

- [ ] **Step 7: Type-check**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/account/AddAccountDialog.tsx src/components/account/AddAccountDialog.test.tsx src/i18n/locales/
git commit -m "feat(frontend): wire screen QR scan into AddAccountDialog"
```

---

## Task 6: Final check and push

- [ ] **Step 1: Run full test suite one more time**

```bash
bun run test
```

Expected: all tests PASS.

- [ ] **Step 2: Lint**

```bash
bun run lint:ci
```

Expected: no errors.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feature/screen-qr-scan
```
