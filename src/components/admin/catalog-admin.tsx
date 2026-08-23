"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import CatalogEntryForm from "@/components/admin/catalog-entry-form";
import { Chip, PageHeader } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminEntry,
  deleteAdminEntry,
  listAdminCatalog,
  patchAdminEntry,
  type AdminCatalogEntry,
  type AdminCatalogPatch,
} from "@/lib/admin/catalog-client";

/**
 * Stocking the shelf.
 *
 * Saves on blur rather than through an autosave queue, on purpose: a catalog
 * entry is prompt text that will run in other people's brains, and a field that
 * writes itself to production while you are still typing the sentence is the
 * wrong tool for that.
 */
export default function CatalogAdmin() {
  const [entries, setEntries] = useState<AdminCatalogEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAdminCatalog().then(setEntries, () => setEntries([]));
  }, []);

  const apply = (next: AdminCatalogEntry) =>
    setEntries(
      (prev) =>
        prev?.map((entry) => (entry.id === next.id ? next : entry)) ?? prev,
    );

  const change = async (id: string, patch: AdminCatalogPatch) => {
    apply(await patchAdminEntry(id, patch));
  };

  const add = async () => {
    const value = slug.trim().toLowerCase();
    if (!value || busy) return;
    setBusy(true);
    try {
      const entry = await createAdminEntry({ slug: value, name: value });
      setEntries((prev) => [...(prev ?? []), entry]);
      setOpenId(entry.id);
      setSlug("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Skill catalog"
        description="What creators see when they browse skills. Publishing an entry puts it on the shelf; editing its text offers an update to everyone who took a copy."
        actions={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={slug}
              placeholder="new-entry-slug"
              aria-label="New entry slug"
              onChange={(event) => setSlug(event.target.value)}
              className="h-9 w-48"
            />
            <Button type="submit" disabled={busy || !slug.trim()}>
              New
            </Button>
          </form>
        }
      />

      {entries === null ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="border-border divide-border/60 divide-y rounded-xl border">
          {entries.map((entry) => (
            <div key={entry.id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
                aria-expanded={openId === entry.id}
                className="hover:bg-muted/50 flex min-h-10 w-full items-center gap-2.5 px-4 text-left transition-colors"
              >
                <ChevronRight
                  aria-hidden
                  className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform ${
                    openId === entry.id ? "rotate-90" : ""
                  }`}
                />
                <span className="text-foreground shrink-0 text-sm font-medium">
                  {entry.name}
                </span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-[13px]">
                  {entry.slug}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  v{entry.version}
                </span>
                <Chip tone={entry.published ? "green" : "neutral"}>
                  {entry.published ? "Live" : "Draft"}
                </Chip>
              </button>
              {openId === entry.id && (
                <CatalogEntryForm
                  entry={entry}
                  onChange={(patch) => void change(entry.id, patch)}
                  onDelete={async () => {
                    await deleteAdminEntry(entry.id);
                    setEntries(
                      (prev) =>
                        prev?.filter((other) => other.id !== entry.id) ?? prev,
                    );
                  }}
                />
              )}
            </div>
          ))}
          {!entries.length && (
            <p className="text-muted-foreground px-4 py-6 text-[13px]">
              Nothing on the shelf. Add a slug above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
