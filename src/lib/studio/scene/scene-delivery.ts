import { parseDesignReply } from "./design-reply";
import { generateSceneImage, type SceneImage } from "./generate-scene-image";
import {
  cleanOverlayDescription,
  cleanOverlayName,
  uniqueOverlayName,
} from "./overlay-name";
import type { OverlayScene } from "./scene-types";
import { validateScene } from "./scene-validate";

/**
 * From the designer's reply to something the app can render: the requested
 * pictures generated, the scene validated against the pictures that actually
 * arrived, the name and description checked. Shared by the design batch and
 * the revise route so one moment goes through exactly one pipeline.
 */
export interface DeliveredImage extends SceneImage {
  key: string;
}

export interface DeliveredScene {
  id: string;
  name: string;
  description: string;
  scene: OverlayScene;
  images: DeliveredImage[];
  notes: string[];
}

export interface FailedScene {
  id: string;
  reason: string;
}

/** A credit hold for one picture, released when the picture does not arrive. */
export interface ImageReservation {
  release(reason: string): Promise<void>;
}

export interface SceneDeliveryInput {
  id: string;
  reply: string;
  /** What the planner said, used when the designer's own name or description fails the checks. */
  fallback: {
    brief: string;
    quote: string;
    name?: string;
    description?: string;
  };
  frameHeightPx: number;
  boxHeightPx: number;
  /** Names already in use; the delivered name is appended by the caller. */
  takenNames: readonly string[];
  existingImageKeys?: readonly string[];
  hasBrandLogo?: boolean;
  /** Absent means pictures cost nothing here (they are still generated). */
  reserveImage?: () => Promise<ImageReservation | null>;
  signal?: AbortSignal;
}

export type SceneDelivery =
  | { ok: true; scene: DeliveredScene }
  | { ok: false; failed: FailedScene };

/** A message the creator can act on, never a stack trace. */
function imageNote(key: string, error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "image_too_large")
    return `Left out the picture "${key}": it came back too large.`;
  return `Left out the picture "${key}": it could not be generated.`;
}

export async function deliverScene(
  input: SceneDeliveryInput,
): Promise<SceneDelivery> {
  const reply = parseDesignReply(input.reply);
  if (!reply)
    return { ok: false, failed: { id: input.id, reason: "invalid_scene" } };

  const notes: string[] = [];
  const images: DeliveredImage[] = [];
  const holds: ImageReservation[] = [];
  // Sequential on purpose: a moment asks for two pictures at most, and the
  // batch already runs three moments at once against the image API.
  for (const request of reply.images) {
    const hold = input.reserveImage ? await input.reserveImage() : null;
    if (input.reserveImage && !hold) {
      notes.push(`Left out the picture "${request.key}": not enough credits.`);
      continue;
    }
    try {
      const image = await generateSceneImage(request, input.signal);
      if (!image) {
        notes.push(
          `Left out the picture "${request.key}": picture generation is not configured.`,
        );
        await hold?.release("no_provider");
        continue;
      }
      images.push({ key: request.key, ...image });
      if (hold) holds.push(hold);
    } catch (error) {
      notes.push(imageNote(request.key, error));
      await hold?.release(
        error instanceof Error ? error.message : "image_failed",
      );
    }
  }

  if (images.length !== reply.images.length) {
    // A title and an empty picture slot is not the design the creator asked
    // for. Refund delivered pictures too when the composition is incomplete.
    await Promise.all(holds.map((hold) => hold.release("image_failed")));
    return { ok: false, failed: { id: input.id, reason: "image_failed" } };
  }

  const validated = validateScene(reply.scene, {
    hasBrandLogo: input.hasBrandLogo,
    imageKeys: [
      ...(input.existingImageKeys ?? []),
      ...images.map((image) => image.key),
    ],
    frameHeightPx: input.frameHeightPx,
    boxHeightPx: input.boxHeightPx,
  });
  if (!validated) {
    // Nothing is delivered, so nothing is charged, pictures included.
    await Promise.all(holds.map((hold) => hold.release("invalid_scene")));
    return { ok: false, failed: { id: input.id, reason: "invalid_scene" } };
  }

  const name = uniqueOverlayName(
    cleanOverlayName(reply.name ?? input.fallback.name, input.fallback),
    input.takenNames,
    input.fallback.quote,
  );
  const description =
    cleanOverlayDescription(reply.description) ||
    cleanOverlayDescription(input.fallback.description);
  return {
    ok: true,
    scene: {
      id: input.id,
      name,
      description,
      scene: validated.scene,
      images,
      notes: [...notes, ...validated.notes],
    },
  };
}
