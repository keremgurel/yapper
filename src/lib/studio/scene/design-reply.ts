import { extractJsonObject, replyString } from "./reply-json";
import { SCENE_LIMITS } from "./scene-limits";
import type { SceneImageRequest } from "./scene-types";

export interface DesignReply {
  name?: string;
  description?: string;
  /** The scene as written. The route validates it before anything renders. */
  scene: unknown;
  images: SceneImageRequest[];
}

const KEY = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_IMAGE_PROMPT = 1_000;

/**
 * Pull the designer's answer apart without judging the scene: that is
 * `validateScene`'s job and the two must not disagree. Image requests are
 * checked here because they cost money before the scene is validated.
 */
export function parseDesignReply(content: string): DesignReply | null {
  const parsed = extractJsonObject(content);
  if (!parsed) return null;
  const scene =
    parsed.scene != null && typeof parsed.scene === "object"
      ? parsed.scene
      : null;
  if (!scene) return null;
  const images: SceneImageRequest[] = [];
  const keys = new Set<string>();
  for (const entry of Array.isArray(parsed.images) ? parsed.images : []) {
    if (images.length >= SCENE_LIMITS.maxImages) break;
    if (entry == null || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    const prompt = replyString(raw.prompt, MAX_IMAGE_PROMPT);
    if (!KEY.test(key) || keys.has(key) || !prompt) continue;
    const aspect =
      typeof raw.aspect === "number" && Number.isFinite(raw.aspect)
        ? Math.min(5, Math.max(0.2, raw.aspect))
        : 1;
    keys.add(key);
    images.push({ key, prompt, aspect });
  }
  return {
    name: replyString(parsed.name, 120),
    description: replyString(parsed.description, 400),
    scene,
    images,
  };
}
