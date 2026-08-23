import type { SkillCatalogRow } from "@/lib/db/skill-catalog";

/** A catalog entry as the admin table sees it. The row type verbatim, because
 * this surface edits the record rather than a view of it. */
export type AdminCatalogEntry = Omit<
  SkillCatalogRow,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type AdminCatalogPatch = Partial<
  Pick<
    AdminCatalogEntry,
    | "slug"
    | "kind"
    | "name"
    | "tagline"
    | "whenToUse"
    | "instructions"
    | "surfaces"
    | "category"
    | "published"
    | "sortOrder"
  >
>;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`admin_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listAdminCatalog(): Promise<AdminCatalogEntry[]> {
  return (
    await json<{ entries: AdminCatalogEntry[] }>(
      await fetch("/api/admin/skills"),
    )
  ).entries;
}

export async function createAdminEntry(
  input: AdminCatalogPatch & { slug: string; name: string },
): Promise<AdminCatalogEntry> {
  return (
    await json<{ entry: AdminCatalogEntry }>(
      await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    )
  ).entry;
}

export async function patchAdminEntry(
  id: string,
  patch: AdminCatalogPatch,
): Promise<AdminCatalogEntry> {
  return (
    await json<{ entry: AdminCatalogEntry }>(
      await fetch(`/api/admin/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    )
  ).entry;
}

export async function deleteAdminEntry(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/admin/skills/${id}`, { method: "DELETE" }),
  );
}
