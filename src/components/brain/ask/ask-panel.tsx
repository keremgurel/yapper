"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrainAsk } from "@/hooks/use-brain-ask";
import type { BlockSuggestion, BrainBlockPatch } from "@/lib/brain/client";

const OPENERS = [
  "What should I post this week?",
  "Which pillar am I neglecting?",
  "Why are my hooks not landing?",
  "What am I missing about my audience?",
];

/**
 * The coach, with the brain in front of it.
 *
 * It answers from what is written down, and when the conversation turns up
 * something worth keeping it offers that back as a section. Offers, not writes:
 * the brain is the creator's, and an assistant that edited it silently would be
 * a thing to distrust rather than a thing to talk to.
 */
export default function AskPanel({
  onSave,
}: {
  onSave: (block: BrainBlockPatch & { title: string }) => Promise<unknown>;
}) {
  const { messages, suggestions, pending, send, dismiss } = useBrainAsk();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const ask = async (question: string) => {
    setDraft("");
    await send(question);
  };

  const save = async (suggestion: BlockSuggestion) => {
    setSaving(suggestion.title);
    try {
      await onSave({
        title: suggestion.title,
        kind: suggestion.kind,
        body: suggestion.body,
        items: suggestion.items,
      });
      dismiss(suggestion.title);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Section title="Ask your brain">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">
          It answers from what is in here, and says so when the answer is not.
        </p>

        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {OPENERS.map((opener) => (
              <button
                key={opener}
                type="button"
                onClick={() => void ask(opener)}
                className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border px-3 py-1 text-xs transition-colors"
              >
                {opener}
              </button>
            ))}
          </div>
        ) : (
          <ol className="space-y-3">
            {messages.map((message, index) => (
              <li
                key={`${index}-${message.role}`}
                className={
                  message.role === "user"
                    ? "text-sm font-medium"
                    : "text-muted-foreground text-sm whitespace-pre-wrap"
                }
              >
                {message.content}
              </li>
            ))}
            {pending && (
              <li className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </li>
            )}
          </ol>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <article
                key={suggestion.title}
                className="bg-muted space-y-2 rounded-xl p-3"
              >
                <p className="text-foreground text-[13px] font-semibold">
                  {suggestion.title}
                </p>
                {suggestion.body && (
                  <p className="text-muted-foreground text-sm">
                    {suggestion.body}
                  </p>
                )}
                {suggestion.items.length > 0 && (
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-sm">
                    {suggestion.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void save(suggestion)}
                    disabled={saving === suggestion.title}
                  >
                    Add to brain
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss(suggestion.title)}
                  >
                    No thanks
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={draft}
            placeholder="Ask anything about your content"
            aria-label="Ask your brain"
            onChange={(event) => setDraft(event.target.value)}
            className="h-9 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            aria-label="Send"
            disabled={pending || !draft.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Section>
  );
}
