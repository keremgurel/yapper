"use client";

import { useCallback, useState } from "react";
import {
  draftFromPaste,
  nameIt,
  readTextFile,
  type IngestDraft,
  type IngestProposal,
} from "@/lib/brain/ingest-client";

export type IngestError = "file_too_large" | "naming_failed" | null;

/**
 * Turning a paste into something ready to save.
 *
 * The parse is synchronous and local, so the draft exists the moment the
 * creator lets go of the file. Naming is a separate, optional step they can
 * skip by typing a title themselves, which matters because it is the only part
 * that costs a credit.
 */
export function useBrainIngest(): {
  draft: IngestDraft | null;
  naming: boolean;
  error: IngestError;
  fromText: (text: string) => void;
  fromFile: (file: File) => Promise<void>;
  editProposal: (patch: Partial<IngestProposal>) => void;
  askForAName: () => Promise<void>;
  reset: () => void;
} {
  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState<IngestError>(null);

  const fromText = useCallback((text: string) => {
    setError(null);
    setDraft(text.trim() ? draftFromPaste(text) : null);
  }, []);

  const fromFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await readTextFile(file);
      const next = draftFromPaste(text);
      // The filename is the one piece of provenance a file import has, and it
      // is usually the best source label the creator will get.
      next.proposal.sourceLabel = file.name;
      setDraft(next);
    } catch {
      setError("file_too_large");
    }
  }, []);

  const editProposal = useCallback((patch: Partial<IngestProposal>) => {
    setDraft((prev) =>
      prev ? { ...prev, proposal: { ...prev.proposal, ...patch } } : prev,
    );
  }, []);

  const askForAName = useCallback(async () => {
    if (!draft || naming) return;
    setNaming(true);
    setError(null);
    try {
      const proposal = await nameIt(draft.detected);
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              // A source label the creator already has from the filename beats
              // one the model inferred from twenty rows.
              proposal: {
                ...proposal,
                sourceLabel: prev.proposal.sourceLabel || proposal.sourceLabel,
              },
            }
          : prev,
      );
    } catch {
      setError("naming_failed");
    } finally {
      setNaming(false);
    }
  }, [draft, naming]);

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  return {
    draft,
    naming,
    error,
    fromText,
    fromFile,
    editProposal,
    askForAName,
    reset,
  };
}
