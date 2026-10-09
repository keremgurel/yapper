"use client";

import { X } from "lucide-react";
import { StudioGlassSurface } from "@/components/studio-ui/liquid-glass";
import { Button } from "@/components/ui/button";
import type { BlockSuggestion } from "@/lib/brain/client";
import ChirpyComposer from "@/components/studio-shell/chirpy-composer";
import ChirpyMessageList from "@/components/studio-shell/chirpy-message-list";
import type { ChirpyMessage } from "@/components/studio-shell/chirpy-message";
import { openers, routeLabel } from "@/components/studio-shell/chirpy-openers";

function introFor(pathname: string): string {
  if (pathname === "/studio/home")
    return "From a quick idea to your next post. Pick a starting point, then make it yours.";
  if (pathname.startsWith("/studio/brain"))
    return "Change what Yapper knows, add context, or start something elsewhere in Studio.";
  return "Ask for help with an idea, a script, or your next post.";
}

/** The open Chirpy conversation: header, starting points or messages, and
 * the composer. Render-only; StudioChirpy owns the conversation. */
export default function ChirpyPanel({
  pathname,
  working,
  messages,
  draft,
  onDraft,
  focusRequest,
  onPickOpener,
  onSend,
  onSaveSuggestion,
  onClose,
}: {
  pathname: string;
  working: boolean;
  messages: ChirpyMessage[];
  draft: string;
  onDraft: (draft: string) => void;
  focusRequest: number;
  onPickOpener: (prompt: string) => void;
  onSend: (text: string) => void;
  onSaveSuggestion: (suggestion: BlockSuggestion) => void;
  onClose: () => void;
}) {
  const home = pathname === "/studio/home";
  return (
    <StudioGlassSurface
      render={<section id="chirpy-panel" aria-label="Chat with Chirpy" />}
      sceneClassName="h-full rounded-[20px]"
      className="pointer-events-auto grid h-full w-full grid-rows-[auto_1px_minmax(0,1fr)_auto] overflow-hidden shadow-xl"
    >
      <header className="flex h-[60px] items-center gap-3 pr-3 pl-2">
        {/* The launcher flies into this corner when the panel opens and is
            the avatar here, so the header only keeps its place. */}
        <span aria-hidden className="size-11 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Chirpy</h2>
          <p className="text-muted-foreground truncate text-xs">
            {working
              ? "Working on it…"
              : draft.trim()
                ? "Ready when you are"
                : routeLabel(pathname)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Chirpy"
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto grid size-6 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="bg-border/60" />

      <div
        className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="mt-auto shrink-0">
            <p className="text-muted-foreground mb-2.5 text-[11px]">
              {introFor(pathname)}
            </p>
            <div
              className={
                home ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-1.5"
              }
            >
              {openers(pathname).map((opener) => (
                <Button
                  key={opener.label}
                  variant="contrast"
                  size="sm"
                  type="button"
                  onClick={() => onPickOpener(opener.prompt)}
                  className="h-auto min-h-9 px-3 py-2 text-xs whitespace-normal"
                >
                  {opener.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ChirpyMessageList
            messages={messages}
            working={working}
            onSaveSuggestion={onSaveSuggestion}
          />
        )}
      </div>

      <ChirpyComposer
        focusRequest={focusRequest}
        draft={draft}
        onDraft={onDraft}
        working={working}
        placeholder={
          pathname.startsWith("/studio/brain")
            ? "Ask Chirpy to change your Brain…"
            : "Message Chirpy…"
        }
        onSend={onSend}
      />
    </StudioGlassSurface>
  );
}
