import { hookArr } from "@/lib/content/input";
import { normalizeBlocks } from "@/lib/content/normalize";
import { isVersionFormat, type VersionFormat } from "@/lib/content/formats";
import type { ContentBlock, ContentHook } from "@/lib/db/schema";

const TITLE_MAX = 300;
// A 30 minute long-form read at 150 words a minute is about 27,000
// characters; the lead's 20,000 limit was set for shorts.
const SCRIPT_MAX = 60_000;

export interface ContentVersionInput {
  title?: string | null;
  hooks?: ContentHook[];
  blocks?: ContentBlock[];
  script?: string | null;
  writtenFrom?: VersionFormat | null;
}

/** A safe partial version body. Unknown keys are dropped and a value of the
 * wrong type is ignored, so autosave can send only what changed. */
export function parseVersionInput(
  body: Record<string, unknown>,
): ContentVersionInput {
  const input: ContentVersionInput = {};
  if (body.title === null) input.title = null;
  else if (typeof body.title === "string")
    input.title = body.title.slice(0, TITLE_MAX);
  const hooks = hookArr(body.hooks);
  if (hooks !== undefined) input.hooks = hooks;
  if (Array.isArray(body.blocks)) input.blocks = normalizeBlocks(body.blocks);
  if (body.script === null) input.script = null;
  else if (typeof body.script === "string")
    input.script = body.script.slice(0, SCRIPT_MAX);
  if (body.writtenFrom === null) input.writtenFrom = null;
  else if (isVersionFormat(body.writtenFrom))
    input.writtenFrom = body.writtenFrom;
  return input;
}
