import type { BrainBlock } from "@/lib/brain/client";
import type { BrainSkill } from "@/lib/brain/skills-client";
import type { BrainSurface, CatalogEntryKind } from "@/lib/db/schema";

/** One entry on the shelf, with what this creator already has of it. */
export interface CatalogEntry {
  slug: string;
  version: number;
  kind: CatalogEntryKind;
  name: string;
  tagline: string;
  whenToUse: string;
  instructions: string;
  surfaces: BrainSurface[];
  category: string;
  /** Null when the creator has never installed it. */
  installedVersion: number | null;
  customized: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`catalog_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listCatalog(): Promise<CatalogEntry[]> {
  return (
    await json<{ entries: CatalogEntry[] }>(await fetch("/api/brain/catalog"))
  ).entries;
}

/** Installing a skill entry returns a skill; a context entry returns a section.
 * The caller refreshes whichever list came back. */
export async function installCatalogEntry(
  slug: string,
): Promise<{ skill?: BrainSkill; block?: BrainBlock }> {
  return json<{ skill?: BrainSkill; block?: BrainBlock }>(
    await fetch(`/api/brain/catalog/${encodeURIComponent(slug)}/install`, {
      method: "POST",
    }),
  );
}

/** Whether an installed copy is behind the shelf. Customized copies still show
 * it, but the page asks before overwriting the creator's edits. */
export function updateAvailable(entry: CatalogEntry): boolean {
  return (
    entry.installedVersion !== null && entry.installedVersion < entry.version
  );
}
