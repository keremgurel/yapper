"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  ExternalLink,
  FileJson,
  FolderOpen,
  Loader2,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { strFromU8, unzipSync } from "fflate";
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

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 80 * 1024 * 1024;

type ImportResult = {
  imported: number;
  skipped: number;
};

async function readArchive(file: File): Promise<Record<string, string>> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("archive_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!/\.zip$/i.test(file.name)) {
    if (!/\.(?:json|html?)$/i.test(file.name)) throw new Error("file_type");
    return { [file.name]: strFromU8(bytes) };
  }

  let extractedBytes = 0;
  const unpacked = unzipSync(bytes, {
    filter: (entry) => {
      if (!/\.(?:json|html?)$/i.test(entry.name)) return false;
      if (entry.originalSize > MAX_DOCUMENT_BYTES) return false;
      extractedBytes += entry.originalSize;
      return extractedBytes <= MAX_EXTRACTED_BYTES;
    },
  });
  return Object.fromEntries(
    Object.entries(unpacked).map(([name, value]) => [name, strFromU8(value)]),
  );
}

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="border-border bg-card text-foreground mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-black">
        {number}
      </span>
      <p className="text-foreground/75 text-sm leading-6">{children}</p>
    </li>
  );
}

export default function InstagramImportSheet({
  open,
  onOpenChange,
  existingUrls,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUrls: string[];
  onImport: (entries: InstagramSavedEntry[]) => number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
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
    const grouped = new Map<string, { total: number; newItems: number }>();
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
      const code = reason instanceof Error ? reason.message : "read_failed";
      setError(
        code === "archive_too_large"
          ? "That archive is over 100 MB. Export only Saved items from Instagram and try again."
          : code === "file_type"
            ? "Choose the ZIP, JSON, or HTML file from your Instagram export."
            : code === "no_saves"
              ? "No Instagram post or Reel links were found. Make sure Saved items were included in the export."
              : "Yapper could not read that export. The file is untouched—try the original ZIP from Instagram.",
      );
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
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

  const commit = () => {
    const imported = onImport(importable);
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
          <div className="mb-2 flex items-center gap-2 text-[color:var(--sg-accent)]">
            <Archive className="h-4 w-4" />
            <span className="text-[11px] font-black tracking-[0.12em] uppercase">
              Instagram archive
            </span>
          </div>
          <SheetTitle className="font-display text-xl font-black">
            Import your saved inspiration
          </SheetTitle>
          <SheetDescription className="leading-5">
            Bring your saved posts and collections into Idea Bank without giving
            Yapper your Instagram password.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {result ? (
            <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)]">
                <Check className="h-6 w-6" />
              </span>
              <h3 className="font-display text-foreground mt-4 text-xl font-black">
                {result.imported} saved{" "}
                {result.imported === 1 ? "post" : "posts"} imported
              </h3>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                They are now in Idea Bank as original references. Expand only
                the ones you want Chirpy to analyze.
              </p>
              {result.skipped > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {result.skipped} existing{" "}
                  {result.skipped === 1 ? "item was" : "items were"} skipped.
                </p>
              )}
              <Button
                className="mt-6"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                View Idea Bank
              </Button>
            </div>
          ) : entries.length ? (
            <div>
              <div className="border-border bg-card/60 flex items-start gap-3 rounded-xl border p-3.5">
                <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--sg-accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-bold">
                    {filename}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {entries.length} unique saves found
                    {duplicateCount
                      ? ` · ${duplicateCount} already in Idea Bank`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground hover:text-foreground text-xs font-bold"
                >
                  Change
                </button>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-foreground text-sm font-black">
                    Choose collections
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Collection names are preserved on imported references.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size === collections.length
                        ? new Set()
                        : new Set(collections.map(([name]) => name)),
                    )
                  }
                  className="text-xs font-bold text-[color:var(--sg-accent)]"
                >
                  {selected.size === collections.length
                    ? "Clear all"
                    : "Select all"}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {collections.map(([name, count]) => {
                  const checked = selected.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleCollection(name)}
                      className={`border-border flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${checked ? "bg-[color:var(--sg-accent)]/8" : "hover:bg-muted/50"}`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white" : "border-border"}`}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <FolderOpen className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-bold">
                        {name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {count.newItems === count.total
                          ? count.total
                          : `${count.newItems} new`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <ol className="space-y-3">
                <Step number={1}>
                  In Instagram, open <strong>Accounts Center</strong>, then
                  <strong> Your information and permissions</strong>.
                </Step>
                <Step number={2}>
                  Choose <strong>Export your information</strong>, select your
                  Instagram profile, then export <strong>Saved</strong> for
                  <strong> All time</strong> in <strong>JSON</strong> format.
                </Step>
                <Step number={3}>
                  When Instagram sends the download, drop the untouched ZIP
                  here.
                </Step>
              </ol>

              <a
                href="https://www.facebook.com/help/181231772500920"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-4"
              >
                Open Meta&apos;s export instructions
                <ExternalLink className="h-3 w-3" />
              </a>

              <input
                ref={inputRef}
                type="file"
                accept=".zip,.json,.html,.htm,application/zip,application/json,text/html"
                className="sr-only"
                onChange={(event) => void load(event.target.files?.[0])}
              />
              <button
                type="button"
                disabled={reading}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void load(event.dataTransfer.files[0]);
                }}
                className={`border-border mt-6 flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/8" : "hover:bg-muted/40"}`}
              >
                {reading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[color:var(--sg-accent)]" />
                ) : (
                  <Upload className="h-6 w-6 text-[color:var(--sg-accent)]" />
                )}
                <span className="text-foreground mt-3 text-sm font-black">
                  {reading
                    ? "Reading your archive…"
                    : "Choose Instagram export"}
                </span>
                <span className="text-muted-foreground mt-1 text-xs">
                  ZIP, JSON, or HTML · up to 100 MB
                </span>
              </button>

              {error && (
                <p role="alert" className="mt-3 text-sm leading-5 text-red-500">
                  {error}
                </p>
              )}

              <div className="mt-5 flex items-start gap-2.5">
                <LockKeyhole className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="text-muted-foreground text-xs leading-5">
                  The archive is read on this device. Yapper imports only the
                  Instagram links you select—not the ZIP or your account
                  credentials.
                </p>
              </div>
            </div>
          )}
        </div>

        {entries.length > 0 && !result && (
          <SheetFooter className="border-border border-t px-5 py-4">
            <Button
              disabled={importable.length === 0}
              onClick={commit}
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
