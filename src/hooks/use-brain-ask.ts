"use client";

import { useCallback, useState } from "react";
import { ask, type AskMessage, type BlockSuggestion } from "@/lib/brain/client";

/**
 * The conversation with the brain.
 *
 * Suggestions belong to the last reply only. A section the coach offered three
 * questions ago has stopped being about what the creator is doing now, and
 * leaving it on screen turns the page into a to-do list nobody asked for.
 */
export function useBrainAsk(): {
  messages: AskMessage[];
  suggestions: BlockSuggestion[];
  pending: boolean;
  send: (question: string) => Promise<void>;
  dismiss: (title: string) => void;
} {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [suggestions, setSuggestions] = useState<BlockSuggestion[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending) return;
      const next: AskMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setSuggestions([]);
      setPending(true);
      try {
        const answer = await ask(next);
        setMessages([...next, { role: "assistant", content: answer.reply }]);
        setSuggestions(answer.suggestions);
      } catch {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: "That did not go through. Ask me again.",
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [messages, pending],
  );

  const dismiss = useCallback((title: string) => {
    setSuggestions((prev) => prev.filter((s) => s.title !== title));
  }, []);

  return { messages, suggestions, pending, send, dismiss };
}
