# Screen QR Scan — Design Spec

**Date:** 2026-04-29  
**Branch:** `feature/screen-qr-scan`

## Overview

Add a "扫描屏幕" button to `AddAccountDialog` that uses the browser's `getDisplayMedia()` API to capture a full-screen frame, automatically decodes any QR code in the image using jsQR, and presents a confirmation dialog before adding the account.

## User Flow

1. User opens `AddAccountDialog` (+ button on main page)
2. Clicks "扫描屏幕" button at the top of the dialog
3. OS native screen-share picker appears → user selects a monitor
4. App captures one video frame, immediately stops the stream
5. jsQR scans the full frame for a QR code
6. **Found:** `ScanConfirmDialog` opens with account preview (issuer, name, algorithm, digits, period)
7. **Not found:** Inline error "未检测到有效 QR 码" + retry button
8. User confirms → `addAccount` called → queries invalidated → all dialogs closed

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/hooks/useScreenScan.ts` | Encapsulates `getDisplayMedia` + canvas frame capture + jsQR decode + `parseOtpauthUri` invoke |
| `src/components/account/ScanConfirmDialog.tsx` | Confirmation dialog showing parsed account details |

### Modified files

| File | Change |
|------|--------|
| `src/components/account/AddAccountDialog.tsx` | Add "扫描屏幕" button; render `ScanConfirmDialog` |

### New dependency

```
jsqr  (pure-JS QR decoder, ~5 KB, no native bindings)
```

## Component Design

### `useScreenScan`

```ts
type ScreenScanResult =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "found"; item: ImportAccountItem }
  | { status: "not_found" }
  | { status: "error"; message: string };

function useScreenScan(): {
  result: ScreenScanResult;
  scan: () => Promise<void>;
  reset: () => void;
}
```

Internals:
1. Call `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`
2. Pipe stream to a hidden `<video>` element, await `loadedmetadata`
3. Draw one frame to an offscreen `<canvas>`, stop all tracks
4. Call `jsQR(imageData.data, width, height)`
5. If null → `{ status: "not_found" }`
6. If data → `invoke("parse_otpauth_uri_cmd", { uri: data })` → `{ status: "found", item }`
7. Catch `AbortError` / `NotAllowedError` → return to `idle` silently

### `ScanConfirmDialog`

Props: `item: ImportAccountItem | null`, `onConfirm`, `onCancel`

Shows: issuer (if present), name, algorithm, digits, period.  
Confirm → caller invokes `addAccount`, closes both dialogs.

### `AddAccountDialog` changes

- Add "扫描屏幕" button above the form (full width, outline variant)
- Wire `useScreenScan` hook
- Show inline error when `result.status === "not_found"` or `"error"`
- Show retry button that calls `scan()` again
- Open `ScanConfirmDialog` when `result.status === "found"`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| User cancels OS picker | Catch `AbortError`/`NotAllowedError` → stay idle, no error shown |
| No QR in frame | Inline: "未检测到有效 QR 码" + 重试 button |
| Invalid otpauth URI | Show error message from `parseOtpauthUri` rejection |
| Invalid TOTP parameters | Reject unsupported algorithm, digits outside 6-8, or period outside 15-300 before adding |
| `getDisplayMedia` not supported | Button disabled with localized browser title fallback for unsupported envs |
| Add after scan fails | Keep confirmation dialog open and show the add error inline |

## Testing

- `useScreenScan.test.ts`: mock `navigator.mediaDevices.getDisplayMedia`, mock jsQR module
  - QR found → status transitions to `found` with correct item
  - No QR found → status is `not_found`
  - User cancels (AbortError) → status stays `idle`
  - Invalid URI → status is `error` with message
- `ScanConfirmDialog.test.tsx`: renders account preview correctly; calls `onConfirm`/`onCancel`
- `AddAccountDialog.test.tsx`: existing tests must continue to pass; new test for scan button presence

## Out of Scope

- Region selection (full-frame auto-detect only)
- Continuous/real-time scanning
- Clipboard image paste
- Mobile camera integration
