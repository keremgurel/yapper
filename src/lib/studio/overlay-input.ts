export interface OverlayInput {
  instruction?: string;
  words: { text: string }[];
  files?: {
    name: string;
    kind: "video" | "image";
    duration: number;
    aspect?: number;
  }[];
  frameAspect?: number;
  speaker?: {
    at: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  effects?: { id: string; name: string; detail: string }[];
  placed?: { name: string; at: number }[];
}

const MAX_WORDS = 5_000;
const MAX_WORD_CHARS = 80;
const MAX_TRANSCRIPT_CHARS = 30_000;

const finiteBetween = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Strictly validate everything interpolated into the overlay provider prompt. */
export function parseOverlayInput(value: unknown): OverlayInput | null {
  const body = record(value);
  if (!body || !Array.isArray(body.words)) return null;
  if (body.words.length > MAX_WORDS) return null;

  let transcriptChars = 0;
  const words: { text: string }[] = [];
  for (const entry of body.words) {
    const word = record(entry);
    if (
      !word ||
      typeof word.text !== "string" ||
      !word.text.trim() ||
      word.text.length > MAX_WORD_CHARS
    ) {
      return null;
    }
    transcriptChars += word.text.length;
    if (transcriptChars > MAX_TRANSCRIPT_CHARS) return null;
    words.push({ text: word.text });
  }

  const instruction = body.instruction;
  if (
    instruction !== undefined &&
    (typeof instruction !== "string" || instruction.length > 1_000)
  ) {
    return null;
  }

  let files: OverlayInput["files"];
  if (body.files !== undefined) {
    if (!Array.isArray(body.files) || body.files.length > 50) return null;
    files = [];
    for (const entry of body.files) {
      const file = record(entry);
      if (
        !file ||
        typeof file.name !== "string" ||
        file.name.length === 0 ||
        file.name.length > 200 ||
        (file.kind !== "video" && file.kind !== "image") ||
        !finiteBetween(file.duration, 0, 7_200) ||
        (file.aspect !== undefined && !finiteBetween(file.aspect, 0.01, 20))
      )
        return null;
      files.push({
        name: file.name,
        kind: file.kind,
        duration: file.duration,
        ...(file.aspect === undefined ? {} : { aspect: file.aspect as number }),
      });
    }
  }

  let effects: OverlayInput["effects"];
  if (body.effects !== undefined) {
    if (!Array.isArray(body.effects) || body.effects.length > 50) return null;
    effects = [];
    for (const entry of body.effects) {
      const effect = record(entry);
      if (
        !effect ||
        typeof effect.id !== "string" ||
        effect.id.length === 0 ||
        effect.id.length > 80 ||
        typeof effect.name !== "string" ||
        effect.name.length > 100 ||
        typeof effect.detail !== "string" ||
        effect.detail.length > 300
      )
        return null;
      effects.push({ id: effect.id, name: effect.name, detail: effect.detail });
    }
  }

  let placed: OverlayInput["placed"];
  if (body.placed !== undefined) {
    if (!Array.isArray(body.placed) || body.placed.length > 100) return null;
    placed = [];
    for (const entry of body.placed) {
      const item = record(entry);
      if (
        !item ||
        typeof item.name !== "string" ||
        item.name.length === 0 ||
        item.name.length > 200 ||
        !finiteBetween(item.at, 0, 7_200)
      )
        return null;
      placed.push({ name: item.name, at: item.at });
    }
  }

  let speaker: OverlayInput["speaker"];
  if (body.speaker !== undefined) {
    if (!Array.isArray(body.speaker) || body.speaker.length > 300) return null;
    speaker = [];
    for (const entry of body.speaker) {
      const sample = record(entry);
      if (
        !sample ||
        !finiteBetween(sample.at, 0, 7_200) ||
        !finiteBetween(sample.x, 0, 1) ||
        !finiteBetween(sample.y, 0, 1) ||
        !finiteBetween(sample.width, 0.001, 1) ||
        !finiteBetween(sample.height, 0.001, 1) ||
        sample.x + sample.width > 1.001 ||
        sample.y + sample.height > 1.001
      )
        return null;
      speaker.push({
        at: sample.at,
        x: sample.x,
        y: sample.y,
        width: sample.width,
        height: sample.height,
      });
    }
  }

  if (
    body.frameAspect !== undefined &&
    !finiteBetween(body.frameAspect, 0.01, 20)
  ) {
    return null;
  }

  return {
    words,
    ...(instruction === undefined
      ? {}
      : { instruction: instruction as string }),
    ...(files === undefined ? {} : { files }),
    ...(effects === undefined ? {} : { effects }),
    ...(placed === undefined ? {} : { placed }),
    ...(speaker === undefined ? {} : { speaker }),
    ...(body.frameAspect === undefined
      ? {}
      : { frameAspect: body.frameAspect as number }),
  };
}
