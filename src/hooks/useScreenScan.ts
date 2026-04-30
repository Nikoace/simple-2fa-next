import jsQR from "jsqr";
import { useState } from "react";

import { captureScreenFrame } from "@/lib/screenCapture";
import { type ImportAccountItem, parseOtpauthUri } from "@/lib/tauri";

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
