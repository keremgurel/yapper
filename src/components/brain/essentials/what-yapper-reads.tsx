"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import PromptPreview from "@/components/brain/recall/prompt-preview";

/** The compiled context, behind a fold, for the creator who wants to check it. */
export default function WhatYapperReads({ version }: { version: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-border/70 border-t pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <ChevronRight
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        What Yapper reads
      </button>
      {open ? (
        <div className="mt-4">
          <PromptPreview version={version} />
        </div>
      ) : null}
    </section>
  );
}
