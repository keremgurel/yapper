import { createContent } from "@/lib/content/client";
import { ideaToContentPatch } from "@/lib/ideas/curate";
import type { Idea, IdeaExpansion, IdeaInput } from "@/lib/ideas/types";

/**
 * Ask the server to expand a raw idea into its full plan. Throws on failure so
 * the caller can keep the idea in the bank un-expanded and offer a retry rather
 * than lose the creator's captured words.
 */
export async function expandIdeaRemote(
  input: IdeaInput,
  pillars: string[] = [],
): Promise<IdeaExpansion> {
  const res = await fetch("/api/ideas/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, pillars }),
  });
  if (!res.ok) throw new Error(`expand_${res.status}`);
  const data = (await res.json()) as { expansion?: IdeaExpansion };
  if (!data.expansion) throw new Error("expand_empty");
  return data.expansion;
}

/** Promote an idea into the Content Library as a drafted item to shoot. */
export async function curateIdea(idea: Idea) {
  return createContent(ideaToContentPatch(idea));
}
