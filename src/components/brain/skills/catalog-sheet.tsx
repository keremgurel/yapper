"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import CatalogCard from "@/components/brain/skills/catalog-card";
import { Section } from "@/components/studio-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSkillCatalog } from "@/hooks/use-skill-catalog";
import type { CatalogEntry } from "@/lib/brain/catalog-client";

/**
 * The shelf.
 *
 * Grouped by category rather than listed flat, because a creator browsing this
 * is not shopping, they are asking "what could improve my scripts". The
 * categories are the answer to that question.
 */
export default function CatalogSheet({
  open,
  onOpenChange,
  onInstalled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
}) {
  const { entries, loading, installing, error, install } =
    useSkillCatalog(open);

  const grouped = useMemo(() => {
    const groups = new Map<string, CatalogEntry[]>();
    for (const entry of entries) {
      const key = entry.category || "Other";
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Skills</SheetTitle>
          <SheetDescription>
            Ways of writing you can hand to the AI. Adding one takes a copy you
            own and can rewrite.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          {loading && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the shelf…
            </p>
          )}

          {error && (
            <p className="text-destructive text-[13px]" role="alert">
              Something went wrong. Close this and open it again.
            </p>
          )}

          {grouped.map(([category, group]) => (
            <Section key={category} title={category} rank="quiet">
              <div className="space-y-2">
                {group.map((entry) => (
                  <CatalogCard
                    key={entry.slug}
                    entry={entry}
                    installing={installing === entry.slug}
                    onInstall={async () => {
                      await install(entry.slug);
                      onInstalled();
                    }}
                  />
                ))}
              </div>
            </Section>
          ))}

          {!loading && !grouped.length && !error && (
            <p className="text-muted-foreground text-[13px]">
              Nothing on the shelf yet.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
