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

if (typeof ImageData === "undefined") {
  (globalThis as Record<string, unknown>).ImageData = class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace = "srgb";
    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height ?? Math.ceil(data.length / 4 / width);
    }
  };
}

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
