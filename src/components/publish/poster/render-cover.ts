import type { CoverDraft } from "@/components/publish/poster/cover-draft";

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

function paintBackground(
  context: CanvasRenderingContext2D,
  preset: CoverDraft["preset"],
) {
  if (preset === "paper") {
    const gradient = context.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, "#eee9df");
    gradient.addColorStop(1, "#9fa9a6");
    context.fillStyle = gradient;
  } else if (preset === "ink") {
    const gradient = context.createRadialGradient(300, 220, 20, 520, 900, 1300);
    gradient.addColorStop(0, "#464646");
    gradient.addColorStop(1, "#080808");
    context.fillStyle = gradient;
  } else {
    const gradient = context.createLinearGradient(0, 0, 800, 1920);
    gradient.addColorStop(0, "#f2a85f");
    gradient.addColorStop(0.34, "#a83525");
    gradient.addColorStop(1, "#27111c");
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, 1080, 1920);
}

/** The cover as a 1080x1920 PNG, rendered client-side so nothing is uploaded
 * until the creator actually publishes. */
export async function renderCover(draft: CoverDraft): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("cover_canvas");

  paintBackground(context, draft.preset);

  const headline = draft.headline.trim() || "Your text hook";
  let fontSize = 80;
  let lines: string[] = [];
  do {
    context.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    lines = wrappedLines(context, headline, 820);
    if (lines.length <= 4) break;
    fontSize -= 5;
  } while (fontSize > 48);

  const lineHeight = fontSize * 1.15;
  const textHeight = lineHeight * lines.length;
  const centerY =
    draft.position === "top" ? 340 : draft.position === "bottom" ? 1560 : 900;
  const hasCard = draft.preset !== "ink";
  if (hasCard) {
    const widest = Math.max(
      ...lines.map((line) => context.measureText(line).width),
    );
    const width = Math.min(940, widest + 120);
    const height = textHeight + 90;
    context.save();
    context.shadowColor = "rgba(0,0,0,.25)";
    context.shadowBlur = 42;
    context.shadowOffsetY = 18;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(540 - width / 2, centerY - height / 2, width, height, 38);
    context.fill();
    context.restore();
  }

  context.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = hasCard ? "#080808" : "#ffffff";
  if (!hasCard) {
    context.shadowColor = "rgba(0,0,0,.8)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
  }
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, 540, firstY + index * lineHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("cover_blob"))),
      "image/png",
      0.95,
    ),
  );
  return new File([blob], "yapper-cover.png", { type: "image/png" });
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
