import {
  RETAKE_PROMPT,
  numberedTranscript,
} from "../../src/lib/studio/retake-clusters.ts";
import { LEGACY_BLOCK_PROMPT } from "./legacy-blocks.mjs";
import { anchorsParagraph, repeatedPairs } from "./anchors.mjs";
import { ENERGY_LEGEND, numberedTranscriptWithEnergy } from "./transcript.mjs";

export const CONNECTOR_RULE =
  "\n\nNever delete a lone connector (but, and, so, because), a sentence " +
  "final qualifier (in that sense, honestly, at the end of the day) or a " +
  "sentence lead-in unless it sits inside a repeated attempt that is being " +
  "removed whole. Shortening a kept sentence is a mistake even when the " +
  "shorter version reads well.";

/** System and user messages for one variant. Production is the default. */
export function buildMessages(fixture, variant) {
  // Production is the keep only contract; "blocks" is the contract it replaced.
  let system =
    variant.contract === "blocks" ? LEGACY_BLOCK_PROMPT : RETAKE_PROMPT;
  if (variant.connectors) system += CONNECTOR_RULE;
  if (variant.energy && fixture.energy) system += ENERGY_LEGEND;

  const transcript =
    variant.energy && fixture.energy
      ? numberedTranscriptWithEnergy(fixture.words, fixture.energy)
      : numberedTranscript(fixture.words);

  let user = transcript;
  if (variant.anchors) {
    const paragraph = anchorsParagraph(repeatedPairs(fixture.words));
    if (paragraph) user = `${paragraph}\n\n${transcript}`;
  }
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
