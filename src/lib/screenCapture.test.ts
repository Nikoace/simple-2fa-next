import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureScreenFrame } from "@/lib/screenCapture";

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
      getImageData: vi.fn().mockReturnValue(new ImageData(new Uint8ClampedArray(4), 1, 1)),
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

  it("stops all tracks when video playback fails", async () => {
    Object.defineProperty(HTMLVideoElement.prototype, "play", {
      value: vi.fn().mockRejectedValue(new Error("play failed")),
      configurable: true,
    });

    await expect(captureScreenFrame(mockStream)).rejects.toThrow("play failed");
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("stops all tracks when frame capture fails", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        throw new Error("capture failed");
      }),
    });

    await expect(captureScreenFrame(mockStream)).rejects.toThrow("capture failed");
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
