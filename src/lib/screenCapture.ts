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
