import { createContent } from "@/lib/content/client";
import { ideaToContentPatch } from "@/lib/ideas/curate";
import type {
  Idea,
  IdeaExpansion,
  IdeaInput,
  IdeaSource,
} from "@/lib/ideas/types";
import type { ResolvedLink } from "@/lib/inspiration/types";

/** Resolve the reference before analysis so its link, title, platform, and
 * original transcript are stored on the idea rather than thrown away. */
export async function resolveIdeaSourceRemote(
  url: string,
): Promise<IdeaSource> {
  const res = await fetch("/api/inspiration/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`resolve_${res.status}`);
  const resolved = (await res.json()) as ResolvedLink;
  return {
    url,
    title: resolved.title,
    platform: resolved.platform,
    transcript: resolved.transcript,
  };
}

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
