import {
  existingSourceUrls,
  importContentItems,
  type ImportItem,
} from "@/lib/db/content";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { normalizeInspoUrl } from "@/lib/inspiration/dedupe";
import { detectPlatform } from "@/lib/inspiration/platform";
import { succeeded, type OperationResult } from "@/lib/http/operation-result";

export interface ReferenceLink {
  url: string;
  title?: string;
  savedAt?: Date;
}

/**
 * Save reference links into the Idea Bank as inspiration ideas: an Instagram
 * saves archive, or links handed to Chirpy.
 *
 * Deduplicated twice over: against what the creator already has, using the
 * same URL normalization the Inspiration library uses, and again at the
 * database via (userId, sourceClientId). Importing the same links again adds
 * nothing.
 *
 * Imported entries land with `transcriptStatus: 'pending'` because their
 * references have not been resolved yet; nothing here claims to have heard
 * them.
 */
export async function importReferences(
  userId: string,
  links: readonly ReferenceLink[],
): Promise<OperationResult<{ imported: number; received: number }>> {
  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const seen = new Set(
    (await existingSourceUrls(userId)).map(normalizeInspoUrl),
  );

  const items: ImportItem[] = [];
  for (const link of links) {
    if (!/^https?:\/\//i.test(link.url)) continue;
    const key = normalizeInspoUrl(link.url);
    if (seen.has(key)) continue;
    seen.add(key);
    const platform = detectPlatform(link.url);
    items.push({
      projectId: project.id,
      status: "captured",
      ideaType: "inspiration",
      sourceUrl: link.url,
      sourceTitle: link.title ?? null,
      sourcePlatform: platform,
      transcriptStatus: "pending",
      // Stable per URL, so the DB unique index catches anything this pass
      // missed.
      sourceClientId:
        `${platform === "instagram" ? "ig" : platform}:${key}`.slice(0, 100),
      createdAt: link.savedAt,
    });
  }

  const imported = await importContentItems(userId, items);
  return succeeded({ imported, received: items.length });
}
