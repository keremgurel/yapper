"use client";

import { useEffect, useState } from "react";

const DRAFT_KEY = "yapper.idea.draft";
const URL_PATTERN = /https?:\/\/[^\s]+/i;

export type ComposerDraft = { text: string; link: string | null };

/** Splits a pasted or dropped string into prose and one link attachment. */
export function pullLink(value: string): ComposerDraft {
  const match = value.match(URL_PATTERN);
  if (!match) return { text: value, link: null };
  return {
    link: match[0].replace(/[),.;]+$/, ""),
    text: value
      .replace(match[0], " ")
      .replace(/\s{2,}/g, " ")
      .trimStart(),
  };
}

/**
 * The composer's text and link attachment, persisted to localStorage so a
 * half-typed 11pm thought survives a closed tab.
 */
export function useCaptureDraft() {
  const [text, setText] = useState("");
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    // Deferred a frame: restoring in the effect body itself would set state
    // synchronously during mount, which the lint rules (rightly) reject.
    const restore = window.requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(saved) as ComposerDraft;
        // A draft saved by the old composer kept its link in a field of its
        // own. Put it back in the sentence, at the end, which is where it was
        // taken from.
        const restored = [parsed.text, parsed.link].filter(Boolean).join(" ");
        if (restored) setText(restored.trim());
      } catch {
        // Drafts from the previous plain-text composer remain valid.
        setText(saved);
      }
    });
    return () => window.cancelAnimationFrame(restore);
  }, []);

  useEffect(() => {
    if (!text && !link) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, link }));
  }, [text, link]);

  /**
   * Typed input, kept exactly as typed.
   *
   * Links used to be lifted out of the sentence into an attachment row, which
   * suited a capture that was only a link and mangled one with a link in the
   * middle of it: the words and the thing they pointed at ended up in two
   * different places. They stay where they are put now, and the composer paints
   * them. See `link-spans` and `LinkHighlightOverlay`.
   */
  const updateText = (value: string) => {
    setText(value);
  };

  const clear = () => {
    setText("");
    setLink(null);
  };

  return { text, link, updateText, setLink, clear };
}
