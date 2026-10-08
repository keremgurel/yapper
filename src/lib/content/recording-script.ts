import type { ContentBlock } from "@/lib/db/schema";

/** Fill the script with actual speech, never generated prose. A later export
 * can refresh an untouched transcript copy, but cannot overwrite a draft. */
export function recordingScriptPatch(
  item: {
    script?: string | null;
    blocks?: ContentBlock[];
    recordedTranscript?: string | null;
    memoryScriptManual?: boolean;
  },
  transcript: string,
): { script?: string | null; blocks?: ContentBlock[] } {
  const text = transcript.trim();
  if (item.memoryScriptManual) return {};
  const previous = item.recordedTranscript?.trim();
  const script = item.script?.trim();
  const blocks = item.blocks ?? [];
  const scriptBlock = blocks.find((block) => block.kind === "script");
  const blockText = scriptBlock?.text?.trim();
  if ((script && script !== previous) || (blockText && blockText !== previous))
    return {};
  if (!text && !previous) return {};
  return {
    script: text || null,
    ...(scriptBlock
      ? {
          blocks: blocks.map((block) =>
            block === scriptBlock ? { ...block, text } : block,
          ),
        }
      : {}),
  };
}
