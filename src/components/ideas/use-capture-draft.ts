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
        if (typeof parsed.text === "string") setText(parsed.text);
        if (typeof parsed.link === "string") setLink(parsed.link);
      } catch {
        // Drafts from the previous plain-text composer remain valid.
        const parsed = pullLink(saved);
        setText(parsed.text);
        setLink(parsed.link);
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

  /** Typed input; the first URL becomes the attachment unless one is set. */
  const updateText = (value: string) => {
    if (link) return setText(value);
    const next = pullLink(value);
    setText(next.text);
    if (next.link) setLink(next.link);
  };

  const clear = () => {
    setText("");
    setLink(null);
  };

  return { text, link, updateText, setLink, clear };
}
