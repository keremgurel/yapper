const LIVE_RECORDING_VIDEO_BITS_PER_SECOND = 16_000_000;
const LIVE_RECORDING_AUDIO_BITS_PER_SECOND = 192_000;

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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
  textColor: string,
) {
  ctx.font = "600 24px sans-serif";
  const width = ctx.measureText(label).width + 34;
  drawRoundedRect(ctx, x, y, width, 42, 21);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + 23);
  return width;
}

export async function startLiveStageRecording({
  sourceStream,
  prompt,
  format,
  showPromptOverlay,
  showTimerOverlay,
  categoryLabel,
  difficultyLabel,
  getTimeLeft,
}: {
  sourceStream: MediaStream;
  prompt: string;
  format: "portrait" | "landscape";
  showPromptOverlay: boolean;
  showTimerOverlay: boolean;
  categoryLabel: string;
  difficultyLabel: string;
  getTimeLeft: () => number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = format === "landscape" ? 1920 : 1080;
  canvas.height = format === "landscape" ? 1080 : 1920;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  const sourceVideo = document.createElement("video");
  sourceVideo.srcObject = new MediaStream(sourceStream.getVideoTracks());
  sourceVideo.playsInline = true;
  sourceVideo.muted = true;
  sourceVideo.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    sourceVideo.onloadedmetadata = () => resolve();
    sourceVideo.onerror = () =>
      reject(new Error("Could not start stage recorder."));
  });

  await sourceVideo.play();

  const canvasStream = canvas.captureStream(30);
  const mergedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...sourceStream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(mergedStream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm",
    videoBitsPerSecond: LIVE_RECORDING_VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: LIVE_RECORDING_AUDIO_BITS_PER_SECOND,
  });

  let animationFrameId = 0;
  let isActive = true;
  const drawFrame = () => {
    if (!isActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const srcW = sourceVideo.videoWidth || canvas.width;
    const srcH = sourceVideo.videoHeight || canvas.height;
    const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;
    ctx.drawImage(sourceVideo, drawX, drawY, drawW, drawH);

    if (showPromptOverlay) {
      const boxX = canvas.width * 0.09;
      const boxY = canvas.height * 0.06;
      const boxWidth = canvas.width * 0.82;
      const boxHeight = canvas.height * (format === "landscape" ? 0.22 : 0.16);
      drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 34);
      ctx.fillStyle = "rgba(10, 14, 25, 0.72)";
      ctx.fill();

      const categoryWidth = drawBadge(
        ctx,
        categoryLabel.toUpperCase(),
        boxX + boxWidth / 2 - 100,
        boxY + 28,
        "rgba(96, 165, 250, 0.24)",
        "#bfd7ff",
      );
      drawBadge(
        ctx,
        difficultyLabel.toUpperCase(),
        boxX + boxWidth / 2 - 100 + categoryWidth + 16,
        boxY + 28,
        "rgba(255, 255, 255, 0.12)",
        "rgba(255,255,255,0.8)",
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = `500 ${Math.round(canvas.width * 0.028)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrapCanvasText(ctx, prompt, boxWidth - 110).slice(0, 3);
      const lineHeight = canvas.height * 0.042;
      const startY =
        boxY + boxHeight / 2 + 18 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, boxX + boxWidth / 2, startY + index * lineHeight);
      });
    }

    if (showTimerOverlay) {
      const secondsLeft = Math.max(0, getTimeLeft());
      ctx.fillStyle = secondsLeft <= 10 ? "#ef4444" : "#ffffff";
      ctx.font = `700 ${Math.round(canvas.width * (format === "landscape" ? 0.06 : 0.1))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${secondsLeft}s`, canvas.width * 0.5, canvas.height * 0.56);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = `500 ${Math.round(canvas.width * 0.014)}px sans-serif`;
      ctx.fillText(
        "SECONDS · DOUBLE-TAP TO TYPE",
        canvas.width * 0.5,
        canvas.height * 0.61,
      );
    }

    animationFrameId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const cleanup = () => {
    isActive = false;
    cancelAnimationFrame(animationFrameId);
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceVideo.pause();
    sourceVideo.srcObject = null;
  };

  return { recorder, cleanup };
}
