export async function captureScreenFrame(stream: MediaStream): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function stopTracks() {
      for (const t of stream.getTracks()) t.stop();
      video.srcObject = null;
    }

    function cleanup() {
      clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      stopTracks();
    }

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function succeed(imageData: ImageData) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(imageData);
    }

    function handleLoadedMetadata() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (canvas.width <= 0 || canvas.height <= 0) {
          fail(new Error("screen capture frame has no dimensions"));
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail(new Error("canvas 2d context unavailable"));
          return;
        }

        ctx.drawImage(video, 0, 0);
        succeed(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (error) {
        fail(error);
      }
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    timeoutId = setTimeout(() => fail(new Error("screen capture metadata timed out")), 5000);

    video.play().catch(fail);
  });
}
