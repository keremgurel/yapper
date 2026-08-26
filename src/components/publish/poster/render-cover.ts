import type { CoverDraft } from "@/components/publish/poster/cover-draft";

const WIDTH = 1080;
const HEIGHT = 1920;

function wrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("cover_image"));
    image.src = src;
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
) {
  const sourceRatio = image.width / image.height;
  const targetRatio = WIDTH / HEIGHT;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
}

function paintHeadline(context: CanvasRenderingContext2D, draft: CoverDraft) {
  if (!draft.showHeadline || !draft.headline.trim()) return;
  const headline = draft.headline.trim();
  let fontSize = 92;
  let lines: string[] = [];
  do {
    context.font = `900 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    lines = wrappedLines(context, headline, 850);
    if (lines.length <= 4) break;
    fontSize -= 6;
  } while (fontSize > 50);

  const lineHeight = fontSize * 1.05;
  const centerY =
    draft.position === "top" ? 330 : draft.position === "bottom" ? 1530 : 920;
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;

  if (draft.position === "bottom") {
    const gradient = context.createLinearGradient(0, 1050, 0, HEIGHT);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.78)");
    context.fillStyle = gradient;
    context.fillRect(0, 980, WIDTH, HEIGHT - 980);
  }

  if (draft.textStyle === "label") {
    const widest = Math.max(
      ...lines.map((line) => context.measureText(line).width),
    );
    const boxWidth = Math.min(970, widest + 110);
    const boxHeight = lineHeight * lines.length + 84;
    context.fillStyle = "#f5d90a";
    context.beginPath();
    context.roundRect(
      (WIDTH - boxWidth) / 2,
      centerY - boxHeight / 2,
      boxWidth,
      boxHeight,
      28,
    );
    context.fill();
  }

  context.font = `900 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = draft.textStyle === "label" ? "#080808" : "#ffffff";
  if (draft.textStyle === "shadow") {
    context.strokeStyle = "rgba(0,0,0,.92)";
    context.lineWidth = Math.max(12, fontSize * 0.14);
    context.lineJoin = "round";
  }
  lines.forEach((line, index) => {
    const y = firstY + index * lineHeight;
    if (draft.textStyle === "shadow") context.strokeText(line, WIDTH / 2, y);
    context.fillText(line, WIDTH / 2, y);
  });
}

/** Render the exact frame/generated artwork shown in Poster as a 9:16 PNG. */
export async function renderCover(draft: CoverDraft): Promise<File> {
  if (!draft.image) throw new Error("cover_image_missing");
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("cover_canvas");

  const image = await loadImage(draft.image);
  drawCoverImage(context, image);
  paintHeadline(context, draft);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("cover_blob"))),
      "image/png",
      0.95,
    ),
  );
  return new File([blob], "yapper-thumbnail.png", { type: "image/png" });
}

export async function downloadCover(draft: CoverDraft) {
  const file = await renderCover(draft);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
