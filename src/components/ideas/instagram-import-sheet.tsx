"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  archiveErrorMessage,
  readArchive,
} from "@/components/ideas/instagram-archive-reader";
import InstagramCollectionList, {
  type CollectionCount,
} from "@/components/ideas/instagram-collection-list";
import InstagramImportResult from "@/components/ideas/instagram-import-result";
import InstagramImportSteps from "@/components/ideas/instagram-import-steps";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  parseInstagramSavedFiles,
  type InstagramSavedEntry,
} from "@/lib/ideas/instagram-saved-import";
import { normalizeInspoUrl } from "@/lib/inspiration/dedupe";

type ImportResult = {
  imported: number;
  skipped: number;
};

/**
 * The Instagram saved-post import flow: instructions and drop target, then a
 * collection chooser, then the result. This shell owns the state machine; the
 * three phases render from the sibling view components.
 */
export default function InstagramImportSheet({
  open,
  onOpenChange,
  existingUrls,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUrls: string[];
  onImport: (entries: InstagramSavedEntry[]) => Promise<number>;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [entries, setEntries] = useState<InstagramSavedEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);

  const existing = useMemo(
    () => new Set(existingUrls.map(normalizeInspoUrl)),
    [existingUrls],
  );
  const collections = useMemo(() => {
    const grouped = new Map<string, CollectionCount>();
    for (const entry of entries) {
      const row = grouped.get(entry.collection) ?? { total: 0, newItems: 0 };
      row.total += 1;
      if (!existing.has(normalizeInspoUrl(entry.url))) row.newItems += 1;
      grouped.set(entry.collection, row);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries, existing]);
  const importable = entries.filter(
    (entry) =>
      selected.has(entry.collection) &&
      !existing.has(normalizeInspoUrl(entry.url)),
  );
  const duplicateCount = entries.filter((entry) =>
    existing.has(normalizeInspoUrl(entry.url)),
  ).length;
  const selectedDuplicateCount = entries.filter(
    (entry) =>
      selected.has(entry.collection) &&
      existing.has(normalizeInspoUrl(entry.url)),
  ).length;

  const reset = () => {
    setError(null);
    setFilename(null);
    setEntries([]);
    setSelected(new Set());
    setResult(null);
  };

  const load = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setError(null);
    setResult(null);
    try {
      const documents = await readArchive(file);
      const parsed = parseInstagramSavedFiles(documents);
      if (!parsed.length) throw new Error("no_saves");
      setFilename(file.name);
      setEntries(parsed);
      setSelected(new Set(parsed.map((entry) => entry.collection)));
    } catch (reason) {
      setError(
        archiveErrorMessage(
          reason instanceof Error ? reason.message : "read_failed",
        ),
      );
    } finally {
      setReading(false);
    }
  };

  const toggleCollection = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const commit = async () => {
    const imported = await onImport(importable);
    setResult({ imported, skipped: selectedDuplicateCount });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="border-border border-b px-5 py-5 pr-12">
          <SheetTitle className="font-display text-lg font-bold">
            Import your saved inspiration
          </SheetTitle>
          <SheetDescription className="leading-5">
            Bring your saved posts and collections into Idea Bank without giving
            Yapper your Instagram password.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {result ? (
            <InstagramImportResult
              imported={result.imported}
              skipped={result.skipped}
              onDone={() => {
                reset();
                onOpenChange(false);
              }}
            />
          ) : entries.length ? (
            <InstagramCollectionList
              filename={filename ?? ""}
              entryCount={entries.length}
              duplicateCount={duplicateCount}
              collections={collections}
              selected={selected}
              onToggle={toggleCollection}
              onToggleAll={() =>
                setSelected(
                  selected.size === collections.length
                    ? new Set()
                    : new Set(collections.map(([name]) => name)),
                )
              }
              onReset={reset}
            />
          ) : (
            <InstagramImportSteps
              reading={reading}
              error={error}
              onFile={(file) => void load(file)}
            />
          )}
        </div>

        {entries.length > 0 && !result && (
          <SheetFooter className="border-border border-t px-5 py-4">
            <Button
              disabled={importable.length === 0}
              onClick={() => void commit()}
              className="w-full justify-between"
            >
              <span>Import {importable.length} new saves</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
