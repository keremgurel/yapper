"use client";

import { useCallback, useState } from "react";

export function usePromptEditor(opts: {
  customPromptText: string | null;
  topicText: string;
  onSave: (trimmed: string | null) => void;
}) {
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const openPromptEditor = useCallback(() => {
    setPromptDraft(opts.customPromptText ?? opts.topicText);
    setPromptEditorOpen(true);
  }, [opts.customPromptText, opts.topicText]);

  const savePromptDraft = useCallback(() => {
    const trimmed = promptDraft.trim();
    opts.onSave(trimmed.length > 0 ? trimmed : null);
    setPromptEditorOpen(false);
  }, [promptDraft, opts]);

  const cancelPromptDraft = useCallback(() => {
    setPromptDraft(opts.customPromptText ?? opts.topicText);
    setPromptEditorOpen(false);
  }, [opts.customPromptText, opts.topicText]);

  const closeEditor = useCallback(() => {
    setPromptEditorOpen(false);
  }, []);

  return {
    promptEditorOpen,
    promptDraft,
    setPromptDraft,
    openPromptEditor,
    savePromptDraft,
    cancelPromptDraft,
    closeEditor,
  };
}
