"use client";

import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/studio-ui";
import { updateAvailable, type CatalogEntry } from "@/lib/brain/catalog-client";

/**
 * One entry on the shelf.
 *
 * Three states, and they have to be distinguishable at a glance: not installed,
 * installed and current, installed and behind. The third is the one that has to
 * be careful, because taking the update replaces text the creator may have
 * rewritten, so a customized copy says so before offering it.
 */
export default function CatalogCard({
  entry,
  installing,
  onInstall,
}: {
  entry: CatalogEntry;
  installing: boolean;
  onInstall: () => void;
}) {
  const installed = entry.installedVersion !== null;
  const stale = updateAvailable(entry);

  return (
    <div className="border-border rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground text-[13px] font-semibold">
            {entry.name}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            {entry.tagline}
          </p>
        </div>
        {installed && !stale ? (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
            <Check aria-hidden className="h-3.5 w-3.5" /> Added
          </span>
        ) : (
          <Button
            type="button"
            variant={stale ? "default" : "outline"}
            size="sm"
            onClick={onInstall}
            disabled={installing}
            className="shrink-0"
          >
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : stale ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {stale ? "Update" : "Add"}
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {entry.kind === "context" ? (
          <Chip tone="violet">Starting point</Chip>
        ) : (
          entry.surfaces.map((surface) => (
            <Chip key={surface} tone="neutral">
              {surface}
            </Chip>
          ))
        )}
        {stale && entry.customized && (
          <span className="text-xs text-[color:var(--sg-yellow-500)]">
            Updating replaces your edits
          </span>
        )}
      </div>
    </div>
  );
}
