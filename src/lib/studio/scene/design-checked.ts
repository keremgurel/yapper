import { callSceneModel } from "./scene-model-call";
import { parseDesignReply } from "./design-reply";
import { validateScene } from "./scene-validate";
import { sceneQualityIssues, type QualityContext } from "./scene-quality";

/** Repairs stay inside the original paid action. Never deliver an unreadable
 * draft or charge a second revision merely to fix our own generation. */
export async function designChecked(input: {
  model: string;
  system: string;
  user: string;
  quality: QualityContext;
  duration: number;
  hasBrandLogo: boolean;
  existingImageKeys?: readonly string[];
  signal?: AbortSignal;
}): Promise<string> {
  const deadline = Date.now() + 220_000;
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let content: string;
    try {
      ({ content } = await callSceneModel({
        model: input.model,
        system: input.system,
        user: input.user + feedback,
        maxCompletionTokens: 8_000,
        timeoutMs: Math.min(100_000, Math.max(1, deadline - Date.now())),
        signal: input.signal,
      }));
    } catch (error) {
      // A cut-off scene is never parsed, but it is repairable: ask for a
      // concise composition instead of making the creator retry the action.
      if (
        error instanceof Error &&
        error.message === "answer_truncated" &&
        attempt < 2 &&
        Date.now() < deadline
      ) {
        feedback =
          "\n\nYour previous answer exceeded the output budget. Recompose the same idea concisely. Return compact JSON only, omit optional fields that equal defaults, reuse groups, and avoid repetitive decorative nodes or overly detailed paths. Preserve the requested meaning and motion; do not return a partial scene.";
        continue;
      }
      throw error;
    }
    const reply = parseDesignReply(content);
    const valid =
      reply &&
      validateScene(reply.scene, {
        imageKeys: [
          ...(input.existingImageKeys ?? []),
          ...reply.images.map((i) => i.key),
        ],
        hasBrandLogo: input.hasBrandLogo,
      });
    const issues = valid
      ? sceneQualityIssues(valid.scene, input.quality)
      : ["Reply is not a valid scene."];
    if (valid && Math.abs(valid.scene.duration - input.duration) > 0.01)
      issues.push("Use exactly the requested duration.");
    if (!issues.length) return content;
    console.warn("[scene] layout preflight", { attempt: attempt + 1, issues });
    feedback = `\n\nYour previous draft failed layout preflight. Redesign it, preserving the factual meaning, not the broken geometry. Use fewer words, generous text boxes, and sequential reveals when space is tight. Do not repeat the draft unchanged.\nIssues:\n${issues.join("\n")}\nPrevious draft:\n${content}`;
  }
  throw new Error("layout_quality_failed");
}
