"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowUp, CheckCircle2, Loader2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Chirpy, type ChirpyExpression } from "@/components/brand/chirpy";
import { Button } from "@/components/ui/button";
import { ask, createBlock } from "@/lib/brain/client";
import type {
  BlockSuggestion,
  BrainBlock,
  NewBrainBlock,
} from "@/lib/brain/client";
import { createIdea } from "@/lib/ideas/client";
import type { ProjectPatch } from "@/lib/project/client";
import {
  invalidateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

type ChirpyAuthor = "you" | "chirpy";

interface ChirpyMessage {
  id: number;
  author: ChirpyAuthor;
  text: string;
  notes?: string[];
  suggestions?: BlockSuggestion[];
  tone?: "done" | "trouble";
}

type NativeChirpyReply = Pick<ChirpyMessage, "text" | "notes" | "tone">;

interface NativeChirpyWindow extends Window {
  __yapperNativeChirpy?: (instruction: string) => Promise<NativeChirpyReply>;
}

export interface ChirpyBrainTools {
  addKnowledge: (block: NewBrainBlock) => Promise<BrainBlock>;
  editKnowledge: (
    query: string,
    patch: { body: string; digest: string },
  ) => BrainBlock | null;
  updateEssentials: (patch: ProjectPatch) => void;
}

interface StudioChirpyValue {
  open: (prompt?: string) => void;
  registerBrainTools: (tools: ChirpyBrainTools | null) => void;
}

const StudioChirpyContext = createContext<StudioChirpyValue | null>(null);

const IDEA_COMMAND = /\b(?:create|make|bank|capture)\b.*\bidea\b/i;
const ADD_CONTEXT_COMMAND =
  /^(?:please\s+)?(?:add|remember|save|note)(?:\s+that)?\s+(.+)/i;
const EDIT_ESSENTIAL_COMMAND =
  /\b(?:change|update|edit|set)\b.*\b(voice|audience)\b.*?\bto\b\s+(.+)/i;
const EDIT_CONTEXT_COMMAND =
  /\b(?:change|update|edit)\b\s+(?:the\s+)?(?:knowledge|context|memory)\s+[“"]?(.+?)[”"]?\s+\bto\b\s+(.+)/i;

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 58) return clean;
  return `${clean.slice(0, 55).trimEnd()}…`;
}

function ideaTextFrom(command: string): string {
  const afterAbout = command.match(/\babout\b\s+(.+)/i)?.[1]?.trim();
  return afterAbout || command.trim();
}

function routeLabel(pathname: string): string {
  if (pathname.startsWith("/studio/ideas")) return "Idea Bank";
  if (pathname.startsWith("/studio/brain")) return "Brain";
  if (pathname.startsWith("/studio/library")) return "Library";
  if (pathname.startsWith("/studio/inspiration")) return "Inspiration";
  return "Studio";
}

function openers(pathname: string): string[] {
  if (pathname.startsWith("/studio/brain")) {
    return [
      "Add that my audience distrusts overnight-success promises",
      "Change my voice to direct, warm, and skeptical of easy answers",
      "Create an idea about why creator shortcuts make content forgettable",
    ];
  }
  if (pathname.startsWith("/studio/ideas")) {
    return [
      "Create an idea from my audience objections",
      "What idea am I missing this week?",
      "Which pillar needs more attention?",
    ];
  }
  return ["What can you help me do here?"];
}

export function useStudioChirpy(): StudioChirpyValue {
  const value = useContext(StudioChirpyContext);
  if (!value)
    throw new Error("useStudioChirpy must be used inside StudioChirpy");
  return value;
}

export default function StudioChirpy({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChirpyMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [isNativeShell, setIsNativeShell] = useState(false);
  const brainTools = useRef<ChirpyBrainTools | null>(null);
  const nextID = useRef(1);
  const composer = useRef<HTMLTextAreaElement>(null);

  const append = useCallback(
    (message: Omit<ChirpyMessage, "id">) =>
      setMessages((current) => [
        ...current,
        { ...message, id: nextID.current++ },
      ]),
    [],
  );

  const open = useCallback((prompt?: string) => {
    setIsOpen(true);
    if (prompt) setDraft(prompt);
    window.setTimeout(() => composer.current?.focus(), 30);
  }, []);

  const registerBrainTools = useCallback((tools: ChirpyBrainTools | null) => {
    brainTools.current = tools;
  }, []);

  useEffect(() => {
    router.prefetch("/studio/ideas");
    setIsNativeShell(
      document.documentElement.hasAttribute("data-yapper-native-swift"),
    );
  }, [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.documentElement.hasAttribute("data-yapper-native-swift"))
        return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setIsOpen((current) => !current);
        window.setTimeout(() => composer.current?.focus(), 30);
        return;
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const addKnowledge = useCallback(async (block: NewBrainBlock) => {
    const tools = brainTools.current;
    return tools ? tools.addKnowledge(block) : createBlock(block);
  }, []);

  const saveSuggestion = useCallback(
    async (suggestion: BlockSuggestion) => {
      try {
        await addKnowledge({
          title: suggestion.title,
          kind: suggestion.kind,
          body: suggestion.body,
          items: suggestion.items,
          usage: "auto",
        });
        setMessages((current) =>
          current.map((message) => ({
            ...message,
            suggestions: message.suggestions?.filter(
              (item) => item.title !== suggestion.title,
            ),
          })),
        );
        append({
          author: "chirpy",
          text: `Added “${suggestion.title}” to your Knowledge.`,
          notes: ["Available when relevant"],
          tone: "done",
        });
      } catch {
        append({
          author: "chirpy",
          text: "I couldn’t save that just now. Nothing was changed.",
          tone: "trouble",
        });
      }
    },
    [addKnowledge, append],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || working) return;
      const answer = (message: Omit<ChirpyMessage, "id" | "author">) => {
        append({ author: "chirpy", ...message });
        return message;
      };
      setDraft("");
      append({ author: "you", text });
      setWorking(true);

      try {
        if (IDEA_COMMAND.test(text)) {
          const ideaRequest = ideaTextFrom(text);
          const generated = await ask([
            {
              role: "user",
              content: `${ideaRequest}\n\nCreate one concrete short-form content idea from my Brain. Give it a strong title, a specific angle, and an opening hook.`,
            },
          ]);
          await createIdea({
            originalNote: generated.reply,
            ideaType: "original",
          });
          invalidateClientResource(STUDIO_RESOURCE_KEYS.ideas);
          const reply = answer({
            text: generated.reply,
            notes: [
              "Created from your Brain",
              "Saved to the Idea Bank",
              "Opening the Idea Bank…",
            ],
            tone: "done",
          });
          startTransition(() => router.push("/studio/ideas"));
          return reply;
        }

        const essential = text.match(EDIT_ESSENTIAL_COMMAND);
        if (essential && brainTools.current) {
          const [, field, value] = essential;
          brainTools.current.updateEssentials(
            field.toLowerCase() === "voice"
              ? { voice: value.trim() }
              : { audience: value.trim() },
          );
          return answer({
            text: `Updated your ${field.toLowerCase()}.`,
            notes: ["Changed in Your Essentials", "Autosaving…"],
            tone: "done",
          });
        }

        const contextEdit = text.match(EDIT_CONTEXT_COMMAND);
        if (contextEdit && brainTools.current) {
          const [, query, body] = contextEdit;
          const changed = brainTools.current.editKnowledge(query.trim(), {
            body: body.trim(),
            digest: titleFrom(body.trim()),
          });
          return answer(
            changed
              ? {
                  text: `Updated “${changed.title}” in your Knowledge.`,
                  notes: ["Autosaving…"],
                  tone: "done",
                }
              : {
                  text: `I couldn’t find Knowledge named “${query.trim()}”. Try its exact title, or ask me to add it instead.`,
                  tone: "trouble",
                },
          );
        }

        const context = text.match(ADD_CONTEXT_COMMAND)?.[1]?.trim();
        if (context) {
          const saved = await addKnowledge({
            title: titleFrom(context),
            kind: "note",
            body: context,
            usage: "auto",
            tags: ["chirpy"],
            sourceLabel: "Conversation with Chirpy",
          });
          return answer({
            text: `Added “${saved.title}” to your Knowledge.`,
            notes: ["Used when relevant", "Source: Chirpy conversation"],
            tone: "done",
          });
        }

        const conversation = messages
          .filter(
            (message) =>
              message.author === "you" || message.author === "chirpy",
          )
          .map((message) => ({
            role:
              message.author === "you"
                ? ("user" as const)
                : ("assistant" as const),
            content: message.text,
          }));
        const response = await ask([
          ...conversation,
          { role: "user", content: text },
        ]);
        return answer({
          text: response.reply,
          suggestions: response.suggestions,
        });
      } catch {
        return answer({
          text: "That didn’t go through. Nothing was changed—ask me again.",
          tone: "trouble",
        });
      } finally {
        setWorking(false);
      }
    },
    [addKnowledge, append, messages, router, working],
  );

  useEffect(() => {
    const nativeWindow = window as NativeChirpyWindow;
    const handler = async (instruction: string): Promise<NativeChirpyReply> => {
      const reply = await send(instruction);
      if (!reply) throw new Error("Chirpy is already working");
      return reply;
    };
    nativeWindow.__yapperNativeChirpy = handler;
    return () => {
      if (nativeWindow.__yapperNativeChirpy === handler)
        delete nativeWindow.__yapperNativeChirpy;
    };
  }, [send]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const value = useMemo(
    () => ({ open, registerBrainTools }),
    [open, registerBrainTools],
  );

  const lastTone = messages.at(-1)?.tone;
  const expression: ChirpyExpression = working
    ? "yap"
    : lastTone === "trouble"
      ? "oops"
      : lastTone === "done"
        ? "happy"
        : "idle";

  return (
    <StudioChirpyContext.Provider value={value}>
      {children}

      {isSignedIn && !isNativeShell ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[60]">
          {isOpen ? (
            <section
              aria-label="Ask Yapper"
              className="bg-background/95 border-border motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 pointer-events-auto grid h-[min(460px,calc(100svh-2rem))] w-[min(560px,calc(100vw-2rem))] origin-bottom-right grid-rows-[46px_1px_minmax(0,1fr)_116px] overflow-hidden rounded-2xl border shadow-[0_18px_60px_rgba(20,16,13,0.3)] backdrop-blur-xl motion-safe:duration-200"
            >
              <header className="flex h-[46px] items-center gap-2.5 px-3">
                <Chirpy expression={expression} talking={working} size={30} />
                <div className="min-w-0">
                  <h2 className="text-xs font-bold">Ask Yapper</h2>
                  <p className="text-muted-foreground truncate text-[10px]">
                    {working
                      ? "Working on it…"
                      : `Yapper · ${routeLabel(pathname)}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Put Chirpy back in the corner"
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto grid size-6 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </header>

              <div className="bg-border/60" />

              <div
                className="flex min-h-0 flex-col justify-end gap-3 overflow-y-auto px-3 py-2.5"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <div className="mt-auto">
                    <p className="text-muted-foreground mb-2.5 text-[11px]">
                      {pathname.startsWith("/studio/brain")
                        ? "Change what Yapper knows, add context, or start something elsewhere in Studio."
                        : "Ask for help, or start something anywhere in Studio."}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {openers(pathname).map((opener) => (
                        <button
                          key={opener}
                          type="button"
                          onClick={() => void send(opener)}
                          className="border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/25 rounded-md border px-2 py-1 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                        >
                          {opener}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {messages.map((message) => (
                      <li key={message.id}>
                        {message.author === "you" ? (
                          <div className="flex justify-end">
                            <p className="bg-muted border-border max-w-[82%] rounded-xl border px-2.5 py-2 text-xs whitespace-pre-wrap">
                              {message.text}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <Chirpy
                              expression={
                                message.tone === "trouble" ? "oops" : "happy"
                              }
                              size={22}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 pt-0.5">
                              <p
                                className={`text-xs whitespace-pre-wrap ${
                                  message.tone === "trouble"
                                    ? "text-[color:var(--sg-accent-strong)]"
                                    : "text-foreground"
                                }`}
                              >
                                {message.text}
                              </p>
                              {message.notes?.length ? (
                                <ul className="text-muted-foreground mt-1.5 space-y-1 text-[10px]">
                                  {message.notes.map((note) => (
                                    <li
                                      key={note}
                                      className="flex items-center gap-1.5"
                                    >
                                      <CheckCircle2
                                        className="size-3 text-emerald-600"
                                        aria-hidden="true"
                                      />
                                      {note}
                                    </li>
                                  ))}
                                </ul>
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
                                        variant="outline"
                                        className="mt-1.5 h-7 text-[10px]"
                                        onClick={() =>
                                          void saveSuggestion(suggestion)
                                        }
                                      >
                                        Add to Knowledge
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
                )}
              </div>

              <form onSubmit={submit} className="p-2.5">
                <div className="bg-card border-border grid h-24 grid-rows-[minmax(0,1fr)_30px] overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-[color:var(--sg-accent)]/30">
                  <textarea
                    ref={composer}
                    name="chirpy-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send(draft);
                      }
                    }}
                    placeholder={
                      pathname.startsWith("/studio/brain")
                        ? "Ask Yapper to change your Brain…"
                        : "Ask Yapper anything…"
                    }
                    aria-label="Message Chirpy"
                    className="text-foreground placeholder:text-muted-foreground min-h-0 resize-none bg-transparent px-2.5 pt-2 text-xs outline-none"
                  />
                  <div className="text-muted-foreground flex items-center gap-2 px-2.5 pb-1 text-[10px]">
                    <span>@ to name something</span>
                    <span className="hidden sm:inline">
                      ⏎ send · ⇧⏎ new line
                    </span>
                    <button
                      type="submit"
                      aria-label="Send"
                      disabled={working || !draft.trim()}
                      className="ml-auto grid size-6 place-items-center rounded-full bg-[color:var(--sg-accent)] text-black transition-opacity focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-30"
                    >
                      {working ? (
                        <Loader2
                          className="size-3 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          ) : (
            <button
              type="button"
              aria-label="Ask Chirpy"
              title="Ask Chirpy · ⌘K"
              onClick={() => open()}
              className="sg-glass pointer-events-auto grid size-[62px] place-items-center rounded-full border-[color:var(--sg-accent)]/30 shadow-[0_6px_20px_rgba(28,23,19,0.24)] transition-transform hover:scale-[1.035] focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Chirpy expression={expression} talking={working} size={46} />
            </button>
          )}
        </div>
      ) : null}
    </StudioChirpyContext.Provider>
  );
}
