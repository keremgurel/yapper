"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { insertDictation } from "@/components/ideas/insert-dictation";

/**
 * Puts dictated words where the caret was, and puts the caret back afterwards.
 *
 * Three things make this fiddly enough to isolate.
 *
 * The caret has to be remembered, not read on demand: clicking the mic button
 * blurs the textarea, and a blurred textarea still reports a selection but the
 * creator's intent was wherever they left off typing. So the last known
 * selection is tracked while they type and used when the transcript lands.
 *
 * The current text has to come from the DOM node rather than a closure.
 * Transcription takes seconds, and the creator can keep typing throughout, so
 * any `text` captured when dictation started is stale by the time it returns.
 * The live `textarea.value` is the only thing guaranteed current at that
 * instant.
 *
 * And the caret can only be restored after React commits the new value. The
 * textarea is controlled, so immediately after `onText` the node still holds
 * the old string and a selection past its length would be clamped to the wrong
 * place. Hence the layout effect keyed on the committed `text`, with the
 * pending position in a ref: storing it in state would mean a setState inside
 * an effect and a cascading render for what is really a one-shot DOM call.
 */
export function useDictationCaret(
  ref: RefObject<HTMLTextAreaElement | null>,
  text: string,
  onText: (value: string) => void,
) {
  const selection = useRef<{ start: number; end: number } | null>(null);
  const pendingCaret = useRef<number | null>(null);

  /** Wire to onSelect/onKeyUp/onClick/onBlur so the last caret is always known. */
  const remember = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    selection.current = {
      start: element.selectionStart,
      end: element.selectionEnd,
    };
  }, [ref]);

  /**
   * Returns the composer's full text after the insert, or null when the take
   * was empty.
   *
   * It hands back the string rather than a boolean because the textarea is
   * controlled: right after `onText` the node still holds the previous value,
   * so a caller about to send cannot read the result off the DOM. Null also
   * lets the caller tell an empty take from a real one and avoid clearing a
   * draft that gained nothing.
   */
  const insert = useCallback(
    (words: string): string | null => {
      const element = ref.current;
      const current = element?.value ?? "";
      const at = selection.current ?? {
        start: current.length,
        end: current.length,
      };
      const next = insertDictation(current, words, at.start, at.end);
      if (next.text === current) return null;

      onText(next.text);
      selection.current = { start: next.caret, end: next.caret };
      pendingCaret.current = next.caret;
      return next.text;
    },
    [ref, onText],
  );

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const element = ref.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(caret, caret);
  }, [text, ref]);

  return { remember, insert };
}
