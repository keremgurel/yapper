import { coverFonts, type CoverDraft } from "./cover-draft";

export const COVER_WIDTH = 1080;
export const COVER_HEIGHT = 1920;

function wrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export function loadCoverImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("cover_image"));
    image.src = src;
  });
}

function paintHeadline(context: CanvasRenderingContext2D, draft: CoverDraft) {
  if (!draft.showHeadline || !draft.headline.trim()) return;
  const { text } = draft;
  const headline = draft.headline.trim();
  let fontSize = text.size;
  const maxWidth = 864;
  let lines: string[];
  const setFont = () => {
    context.font = `800 ${fontSize}px ${coverFonts[text.font].family}`;
  };
  do {
    setFont();
    lines = wrappedLines(context, headline, maxWidth);
    if (lines.length <= 4 || fontSize <= 40) break;
    fontSize = Math.max(40, fontSize - 4);
  } while (true);
  const lineHeight = fontSize * 1.12;
  const targetY =
    draft.position === "top" ? 330 : draft.position === "center" ? 920 : 1530;
  const centerY = Math.max(
    (lines.length * lineHeight) / 2 + 90,
    Math.min(targetY, COVER_HEIGHT - (lines.length * lineHeight) / 2 - 90),
  );
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
  if (text.background) {
    const widest = Math.min(
      maxWidth,
      Math.max(...lines.map((line) => context.measureText(line).width)),
    );
    const boxWidth = widest + fontSize * 0.95;
    const boxHeight = lineHeight * lines.length + fontSize * 0.42;
    context.save();
    if (text.shadow) {
      context.shadowColor = text.shadowColor;
      context.shadowBlur = text.shadowRadius;
      context.shadowOffsetY = text.shadowRadius * 0.25;
    }
    context.fillStyle = text.backgroundColor;
    context.beginPath();
    context.roundRect(
      (COVER_WIDTH - boxWidth) / 2,
      centerY - boxHeight / 2,
      boxWidth,
      boxHeight,
      text.cornerRadius,
    );
    context.fill();
    context.restore();
  }
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = text.fill;
  context.strokeStyle = text.strokeColor;
  context.lineWidth = Math.max(3, fontSize * 0.1);
  context.lineJoin = "round";
  if (text.shadow && !text.background) {
    context.shadowColor = text.shadowColor;
    context.shadowBlur = text.shadowRadius;
    context.shadowOffsetY = text.shadowRadius * 0.25;
  }
  lines.forEach((line, index) => {
    const y = firstY + index * lineHeight;
    if (text.stroke) context.strokeText(line, COVER_WIDTH / 2, y, maxWidth);
    context.fillText(line, COVER_WIDTH / 2, y, maxWidth);
  });
  context.restore();
}

/** Preview, download and upload share the exact same drawing. */
export function paintCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  draft: CoverDraft,
) {
  const scale = Math.max(
    COVER_WIDTH / image.width,
    COVER_HEIGHT / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  context.clearRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  context.drawImage(
    image,
    (COVER_WIDTH - width) / 2,
    (COVER_HEIGHT - height) / 2,
    width,
    height,
  );
  paintHeadline(context, draft);
}

export async function renderCover(
  draft: CoverDraft,
  mimeType: "image/png" | "image/jpeg" = "image/png",
): Promise<File> {
  if (!draft.image) throw new Error("cover_image_missing");
  const image = await loadCoverImage(draft.image);
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("cover_canvas");
  paintCover(context, image, draft);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("cover_export")),
      mimeType,
      0.9,
    ),
  );
  return new File(
    [blob],
    mimeType === "image/png" ? "yapper-thumbnail.png" : "yapper-thumbnail.jpg",
    { type: mimeType },
  );
}

export async function downloadCover(draft: CoverDraft) {
  const file = await renderCover(draft);
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
