"use client";

import { Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import SetupBlocks from "@/components/brain/setup/setup-blocks";
import SetupEssentialRow from "@/components/brain/setup/setup-essential-row";
import SetupPillars from "@/components/brain/setup/setup-pillars";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { useBrainSetup } from "@/hooks/use-brain-setup";
import { IMPORTABLE_EXTENSIONS } from "@/lib/brain/ingest-client";
import {
  SETUP_ESSENTIAL_KEYS,
  type SetupEssentialKey,
} from "@/lib/brain/setup";
import { PROJECT_FIELDS, type Project } from "@/lib/project/client";

const LABELS: Record<SetupEssentialKey, string> = {
  name: "What you call this",
  ...Object.fromEntries(
    PROJECT_FIELDS.map((field) => [field.key, field.label]),
  ),
} as Record<SetupEssentialKey, string>;

/**
 * Set the Brain up from one document.
 *
 * Paste or drop the thing that already describes the content system, read it
 * once, and review what it would write into every Essentials field, the
 * pillar list, and Knowledge. Nothing lands until Apply.
 */
export default function SetupSheet({
  open,
  onOpenChange,
  setup,
  project,
  existingPillars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setup: ReturnType<typeof useBrainSetup>;
  project: Project | null;
  existingPillars: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const {
    document,
    setDocument,
    fromFile,
    proposal,
    selection,
    setSelection,
    editEssential,
    extract,
    extracting,
    apply,
    applying,
    error,
    reset,
  } = setup;

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const close = () => onOpenChange(false);
  const submit = async () => {
    if (await apply()) close();
  };
  const canExtract = document.trim().length >= 40 && !extracting;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Set up from a document</SheetTitle>
          <SheetDescription>
            Drop in the document that describes your content system. It fills
            every Essentials field, your pillars, and the Knowledge worth
            keeping, and you review each part before it lands.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          {!proposal && (
            <>
              <Textarea
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder="Paste the whole thing here…"
                rows={12}
                className="text-[13px] leading-relaxed"
                aria-label="Document"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => input.current?.click()}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Choose a file
                </Button>
                <input
                  ref={input}
                  type="file"
                  accept={IMPORTABLE_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void fromFile(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  disabled={!canExtract}
                  onClick={() => void extract()}
                  className="ml-auto"
                >
                  {extracting ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Sparkles className="size-4" aria-hidden="true" />
                  )}
                  Read it · 1 credit
                </Button>
              </div>
            </>
          )}

          {error === "file_too_large" && (
            <p className="text-destructive text-[13px]" role="alert">
              That file is too large to read in the browser. Paste the part you
              need instead.
            </p>
          )}
          {error === "extract_failed" && (
            <p className="text-destructive text-[13px]" role="alert">
              Couldn’t read that document. Nothing was charged; try again.
            </p>
          )}
          {error === "apply_failed" && (
            <p className="text-destructive text-[13px]" role="alert">
              Some of it couldn’t be saved. Check your Brain, then apply the
              rest again.
            </p>
          )}

          {proposal && selection && (
            <>
              <section className="space-y-4">
                <h3 className="sg-field-label">Essentials</h3>
                {SETUP_ESSENTIAL_KEYS.filter(
                  (key) => proposal.essentials[key] !== undefined,
                ).map((key) => (
                  <SetupEssentialRow
                    key={key}
                    label={LABELS[key]}
                    current={project ? String(project[key] ?? "") : ""}
                    proposed={proposal.essentials[key] ?? ""}
                    selected={selection.essentials.has(key)}
                    onSelect={(on) => {
                      const next = new Set(selection.essentials);
                      if (on) next.add(key);
                      else next.delete(key);
                      setSelection({ ...selection, essentials: next });
                    }}
                    onEdit={(value) => editEssential(key, value)}
                  />
                ))}
              </section>
              <SetupPillars
                pillars={proposal.pillars}
                existingCount={existingPillars}
                selection={selection}
                onChange={setSelection}
              />
              <SetupBlocks
                blocks={proposal.blocks}
                selection={selection}
                onChange={setSelection}
              />
              {proposal.notes && (
                <p className="text-muted-foreground text-[12px]">
                  Not covered: {proposal.notes}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={reset}>
                  Start over
                </Button>
                <Button
                  type="button"
                  disabled={applying}
                  onClick={() => void submit()}
                >
                  {applying && (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Apply to my Brain
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
