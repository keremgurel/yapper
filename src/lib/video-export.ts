function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

export async function exportRecordingWithOverlays({
  blob,
  prompt,
  timerSeconds,
  showPromptOverlay,
  showTimerOverlay,
  format = "portrait",
  onProgress,
}: {
  blob: Blob;
  prompt: string;
  timerSeconds: number;
  showPromptOverlay: boolean;
  showTimerOverlay: boolean;
  format?: "portrait" | "landscape";
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  if (!showPromptOverlay && !showTimerOverlay) return blob;

  const videoBitsPerSecond = format === "landscape" ? 16_000_000 : 14_000_000;
  const audioBitsPerSecond = 192_000;

  const sourceUrl = URL.createObjectURL(blob);

  try {
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true;
    video.volume = 0;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load recording."));
    });

    const canvas = document.createElement("canvas");
    const targetW = format === "landscape" ? 1920 : 1080;
    const targetH = format === "landscape" ? 1080 : 1920;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    const canvasStream = canvas.captureStream(30);
    const captureVideo = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
    };
    const playbackStream =
      typeof captureVideo.captureStream === "function"
        ? captureVideo.captureStream()
        : undefined;
    const mergedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(playbackStream?.getAudioTracks() ?? []),
    ]);

    const recorder = new MediaRecorder(mergedStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
      videoBitsPerSecond,
      audioBitsPerSecond,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
    });

    let animationFrameId: number | null = null;
    let isExporting = true;

    const drawFrame = () => {
      if (!isExporting || video.ended || video.paused) {
        return;
      }

      const progress =
        video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
      onProgress?.(progress);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Keep the full camera frame visible so exports never introduce crop-based zoom.
      const srcW = video.videoWidth || canvas.width;
      const srcH = video.videoHeight || canvas.height;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (canvas.width - drawW) / 2;
      const drawY = (canvas.height - drawH) / 2;
      ctx.drawImage(video, drawX, drawY, drawW, drawH);

      if (showPromptOverlay) {
        const boxX = canvas.width * 0.07;
        const boxY = canvas.height * 0.06;
        const boxWidth = canvas.width * 0.86;
        const boxHeight = canvas.height * 0.2;
        const radius = 28;

        ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxWidth - radius, boxY);
        ctx.quadraticCurveTo(
          boxX + boxWidth,
          boxY,
          boxX + boxWidth,
          boxY + radius,
        );
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
        ctx.quadraticCurveTo(
          boxX + boxWidth,
          boxY + boxHeight,
          boxX + boxWidth - radius,
          boxY + boxHeight,
        );
        ctx.lineTo(boxX + radius, boxY + boxHeight);
        ctx.quadraticCurveTo(
          boxX,
          boxY + boxHeight,
          boxX,
          boxY + boxHeight - radius,
        );
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(canvas.width * 0.045)}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lines = wrapCanvasText(ctx, prompt, boxWidth - 64).slice(0, 3);
        const lineHeight = canvas.height * 0.045;
        const startY =
          boxY + boxHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
          ctx.fillText(line, boxX + boxWidth / 2, startY + index * lineHeight);
        });
      }

      if (showTimerOverlay) {
        const secondsLeft = Math.max(
          0,
          Math.ceil(timerSeconds - video.currentTime),
        );

        ctx.fillStyle = "rgba(15, 23, 42, 0.66)";
        ctx.beginPath();
        ctx.roundRect(
          canvas.width * 0.34,
          canvas.height * 0.78,
          canvas.width * 0.32,
          canvas.height * 0.12,
          28,
        );
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(canvas.width * 0.08)}px Geist, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${secondsLeft}s`,
          canvas.width * 0.5,
          canvas.height * 0.84,
        );
      }

      animationFrameId = requestAnimationFrame(drawFrame);
    };

    recorder.start(200);
    await video.play();
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    isExporting = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    recorder.stop();
    mergedStream.getTracks().forEach((track) => track.stop());
    return await finished;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
