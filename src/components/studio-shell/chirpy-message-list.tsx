"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Chirpy } from "@/components/brand/chirpy";
import type { ChirpyMessage } from "@/components/studio-shell/chirpy-message";
import ChirpyConfirmation from "@/components/studio-shell/chirpy-confirmation";

/** The conversation itself: the creator's turns on the right, Chirpy's on
 * the left with what it saved and any change waiting for a yes.
 * Render-only. */
export default function ChirpyMessageList({
  messages,
  working,
  onAnswerConfirmation,
}: {
  messages: ChirpyMessage[];
  working: boolean;
  onAnswerConfirmation: (
    executionID: string,
    decision: "confirm" | "cancel",
  ) => void;
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
                {message.text ? (
                  <p
                    className={`text-sm break-words whitespace-pre-wrap ${
                      message.tone === "trouble"
                        ? "text-[color:var(--sg-accent-strong)]"
                        : "text-foreground"
                    }`}
                  >
                    {message.text}
                  </p>
                ) : null}
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
                {message.confirm ? (
                  <ChirpyConfirmation
                    confirm={message.confirm}
                    onAnswer={(decision) =>
                      onAnswerConfirmation(
                        message.confirm!.executionID,
                        decision,
                      )
                    }
                  />
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
