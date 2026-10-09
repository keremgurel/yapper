"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Chirpy } from "@/components/brand/chirpy";
import { Button } from "@/components/ui/button";
import type { BlockSuggestion } from "@/lib/brain/client";
import type { ChirpyMessage } from "@/components/studio-shell/chirpy-message";

/** The conversation itself: the creator's turns on the right, Chirpy's on
 * the left with what it saved, brand colors it set, and Knowledge it
 * suggests keeping. Render-only. */
export default function ChirpyMessageList({
  messages,
  working,
  onSaveSuggestion,
}: {
  messages: ChirpyMessage[];
  working: boolean;
  onSaveSuggestion: (suggestion: BlockSuggestion) => void;
}) {
  return (
    <ol className="space-y-3">
      {messages.map((message) => (
        <li key={message.id}>
          {message.author === "you" ? (
            <div className="flex justify-end">
              <p className="bg-muted border-border max-w-[82%] rounded-xl border px-2.5 py-2 text-sm break-words whitespace-pre-wrap">
                {message.text}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Chirpy
                expression={message.tone === "trouble" ? "oops" : "happy"}
                size={22}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm break-words whitespace-pre-wrap ${
                    message.tone === "trouble"
                      ? "text-[color:var(--sg-accent-strong)]"
                      : "text-foreground"
                  }`}
                >
                  {message.text}
                </p>
                {message.notes?.length ? (
                  <ul className="text-muted-foreground mt-1.5 space-y-1 text-[11px]">
                    {message.notes.map((note) => (
                      <li key={note} className="flex items-center gap-1.5">
                        <CheckCircle2
                          className="size-3 text-emerald-600"
                          aria-hidden="true"
                        />
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.brandColors !== undefined ? (
                  <div className="border-border bg-card mt-2 rounded-lg border p-2.5">
                    <div
                      className="flex flex-wrap gap-1.5"
                      aria-label="Saved brand colors"
                    >
                      {message.brandColors.map((color, index) => (
                        <span
                          key={color}
                          className="border-border inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px]"
                        >
                          <span
                            className="size-3.5 rounded-sm border border-black/15"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          {color}
                          {index === 0 ? " · Primary" : ""}
                        </span>
                      ))}
                    </div>
                    <Link
                      href="/studio/brand"
                      className="mt-2 inline-block text-xs font-semibold underline underline-offset-2"
                    >
                      Open brand kit
                    </Link>
                  </div>
                ) : null}
                {message.suggestions?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {message.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.title}
                        className="bg-muted/70 rounded-lg p-2"
                      >
                        <p className="text-[11px] font-semibold">
                          {suggestion.title}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="contrast"
                          className="mt-1.5 text-xs"
                          onClick={() => onSaveSuggestion(suggestion)}
                        >
                          Add to knowledge
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </li>
      ))}
      {working ? (
        <li className="flex items-center gap-2">
          <Chirpy expression="yap" talking size={22} />
          <Loader2
            className="text-muted-foreground size-3.5 animate-spin"
            aria-hidden="true"
          />
          <span className="sr-only">Chirpy is working</span>
        </li>
      ) : null}
    </ol>
  );
}
