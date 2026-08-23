"use client";

import { useState } from "react";
import FilePane from "@/components/brain/add/file-pane";
import PastePane from "@/components/brain/add/paste-pane";
import ProposalPreview from "@/components/brain/add/proposal-preview";
import WritePane from "@/components/brain/add/write-pane";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBrainIngest } from "@/hooks/use-brain-ingest";
import { draftToBlock } from "@/lib/brain/ingest-client";
import type { NewBrainBlock } from "@/lib/brain/client";

type Mode = "write" | "paste" | "file";

const MODES: { value: Mode; label: string }[] = [
  { value: "write", label: "Write it" },
  { value: "paste", label: "Paste anything" },
  { value: "file", label: "Import a file" },
];

/**
 * One way in, three doors.
 *
 * The doors matter because the three cases are genuinely different work. Typing
 * a section is a question the creator answers. Pasting is handing over
 * something they already made elsewhere. A file is the same thing with a name
 * attached. What they must not be is three different features with three
 * different results, so all three land on the same editable preview and become
 * the same kind of section.
 */
export default function AddContextSheet({
  open,
  onOpenChange,
  existingTitles,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTitles: string[];
  onAdd: (block: NewBrainBlock) => Promise<unknown>;
}) {
  const [mode, setMode] = useState<Mode>("write");
  const [saving, setSaving] = useState(false);
  const ingest = useBrainIngest();

  const close = () => {
    ingest.reset();
    onOpenChange(false);
  };

  const save = async () => {
    if (!ingest.draft || saving) return;
    setSaving(true);
    try {
      await onAdd(draftToBlock(ingest.draft));
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Add context</SheetTitle>
          <SheetDescription>
            Anything you know that should shape what gets written. There is no
            fixed set of things this can be.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <div
            role="tablist"
            aria-label="How to add context"
            className="bg-muted inline-flex rounded-lg p-0.5"
          >
            {MODES.map((option) => (
              <button
                key={option.value}
                role="tab"
                type="button"
                aria-selected={mode === option.value}
                onClick={() => {
                  setMode(option.value);
                  ingest.reset();
                }}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  mode === option.value
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "write" && (
            <WritePane
              existingTitles={existingTitles}
              onAdd={async (block) => {
                await onAdd(block);
                close();
              }}
            />
          )}
          {mode === "paste" && <PastePane onText={ingest.fromText} />}
          {mode === "file" && <FilePane onFile={ingest.fromFile} />}

          {ingest.error === "file_too_large" && (
            <p className="text-destructive text-[13px]" role="alert">
              That file is too large to read in the browser. Paste the part you
              need instead.
            </p>
          )}
          {ingest.error === "naming_failed" && (
            <p className="text-muted-foreground text-[13px]" role="alert">
              Could not come up with a name. Type one and it saves the same.
            </p>
          )}

          {ingest.draft && (
            <ProposalPreview
              draft={ingest.draft}
              naming={ingest.naming}
              onEdit={ingest.editProposal}
              onName={ingest.askForAName}
              onSave={save}
              saving={saving}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
