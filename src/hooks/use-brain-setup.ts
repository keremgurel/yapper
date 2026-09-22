"use client";

import { useCallback, useState } from "react";
import type { NewBrainBlock } from "@/lib/brain/client";
import { readTextFile } from "@/lib/brain/ingest-client";
import type { BrainSetupProposal, SetupEssentialKey } from "@/lib/brain/setup";
import {
  blocksFor,
  projectPatchFor,
  proposeSetup,
  selectEverything,
  type SetupSelection,
} from "@/lib/brain/setup-client";
import type { PillarDraft, ProjectPatch } from "@/lib/project/client";

export type SetupError =
  | "file_too_large"
  | "extract_failed"
  | "apply_failed"
  | null;

/**
 * One document in, a reviewed Brain out.
 *
 * Extraction is the only step that costs a credit, so it waits for a click.
 * The proposal is editable before it is applied, and the apply writes through
 * the same project patch and block creates the page uses everywhere else.
 */
export function useBrainSetup({
  existingPillars,
  saveEssentials,
  addBlock,
}: {
  existingPillars: PillarDraft[];
  saveEssentials: (patch: ProjectPatch) => Promise<unknown>;
  addBlock: (block: NewBrainBlock) => Promise<unknown>;
}) {
  const [document, setDocument] = useState("");
  const [proposal, setProposal] = useState<BrainSetupProposal | null>(null);
  const [selection, setSelection] = useState<SetupSelection | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<SetupError>(null);

  const fromFile = useCallback(async (file: File) => {
    setError(null);
    try {
      setDocument(await readTextFile(file));
    } catch {
      setError("file_too_large");
    }
  }, []);

  const extract = useCallback(async () => {
    if (extracting || document.trim().length < 40) return;
    setExtracting(true);
    setError(null);
    try {
      const next = await proposeSetup(document);
      setProposal(next);
      setSelection(selectEverything(next, existingPillars.length));
    } catch {
      setError("extract_failed");
    } finally {
      setExtracting(false);
    }
  }, [document, existingPillars.length, extracting]);

  const editEssential = useCallback((key: SetupEssentialKey, value: string) => {
    setProposal((prev) =>
      prev
        ? { ...prev, essentials: { ...prev.essentials, [key]: value } }
        : prev,
    );
  }, []);

  const apply = useCallback(async (): Promise<boolean> => {
    if (!proposal || !selection || applying) return false;
    setApplying(true);
    setError(null);
    try {
      const patch = projectPatchFor(proposal, selection, existingPillars);
      if (patch) await saveEssentials(patch);
      for (const block of blocksFor(proposal, selection)) await addBlock(block);
      return true;
    } catch {
      setError("apply_failed");
      return false;
    } finally {
      setApplying(false);
    }
  }, [
    addBlock,
    applying,
    existingPillars,
    proposal,
    saveEssentials,
    selection,
  ]);

  const reset = useCallback(() => {
    setDocument("");
    setProposal(null);
    setSelection(null);
    setError(null);
  }, []);

  return {
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
  };
}
