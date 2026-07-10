"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyMention,
  mentionAt,
  suggestMentions,
} from "@/lib/studio/mentions";

/** How many names the popup offers at once. */
const MAX_SUGGESTIONS = 6;

/**
 * A text box that autocompletes `@file name.mp4` against the media library,
 * the way an editor expects. It owns the text, the caret, and which suggestion
 * is highlighted, and nothing else.
 */
export function useMentionInput(
  names: string[],
  /** The box itself, so accepting a suggestion can move the real caret. */
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);

  const span = dismissed ? null : mentionAt(value, caret);
  const query = span?.query ?? null;
  const suggestions = useMemo(
    () =>
      query === null
        ? []
        : suggestMentions(names, query).slice(0, MAX_SUGGESTIONS),
    [names, query],
  );

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
    setDismissed(false);
    setActive(0);
  }, []);

  /** Track the caret when it moves without the text changing (arrows, clicks). */
  const onCaretMove = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      setCaret(e.currentTarget.selectionStart ?? 0);
    },
    [],
  );

  const accept = useCallback(
    (name: string) => {
      if (!span) return;
      const next = applyMention(value, span, name);
      setValue(next.value);
      setCaret(next.caret);
      setActive(0);
      // The DOM caret has to be moved too, or the next keystroke lands at the end.
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(next.caret, next.caret);
        inputRef.current?.focus();
      });
    },
    [span, value, inputRef],
  );

  /** Returns true when the key belonged to the suggestion popup. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
      if (suggestions.length === 0) return false;
      if (e.key === "ArrowDown") {
        setActive((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        accept(suggestions[active]);
      } else if (e.key === "Escape") {
        setDismissed(true);
      } else {
        return false;
      }
      e.preventDefault();
      return true;
    },
    [suggestions, active, accept],
  );

  return {
    value,
    setValue,
    suggestions,
    active,
    accept,
    handlers: {
      onChange,
      onKeyDown,
      onSelect: onCaretMove,
      onClick: onCaretMove,
    },
  };
}
