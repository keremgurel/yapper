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
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import type { ChirpyExpression } from "@/components/brand/chirpy";
import { ask, createBlock, listBlocks, patchBlock } from "@/lib/brain/client";
import { findKnowledge } from "@/lib/brain/find-knowledge";
import type {
  BlockSuggestion,
  BrainBlock,
  NewBrainBlock,
} from "@/lib/brain/client";
import { createIdea } from "@/lib/ideas/client";
import { parseBrandCommand } from "@/lib/brand/command";
import ChirpyPanel from "@/components/studio-shell/chirpy-panel";
import ChirpyDock from "@/components/studio-shell/chirpy-dock/chirpy-dock";
import type { ChirpyMessage } from "@/components/studio-shell/chirpy-message";
import { looksLikeCommand } from "@/components/studio-shell/chirpy-command-gate";
import { SETUP_HANDOFF_KEY } from "@/lib/brain/setup-client";
import { executeBrandCommand } from "@/lib/brand/command-client";
import { patchProject, type ProjectPatch } from "@/lib/project/client";
import {
  invalidateClientResource,
  mutateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

type NativeChirpyReply = Pick<ChirpyMessage, "text" | "notes" | "tone">;

/**
 * What the Mac app sends with an ask: the Studio tab the creator is on, and
 * that tab's own recent conversation. The hidden page sits on one route
 * whatever the tab, so without this Chirpy would read one mixed history and
 * guess the wrong page.
 */
interface NativeChirpyContext {
  surface?: string;
  history?: { author: "you" | "chirpy"; text: string }[];
}

interface NativeChirpyWindow extends Window {
  __yapperNativeChirpy?: (
    instruction: string,
    context?: NativeChirpyContext,
  ) => Promise<NativeChirpyReply>;
  webkit?: {
    messageHandlers?: {
      yapperNative?: { postMessage: (body: unknown) => void };
    };
  };
}

export interface ChirpyBrainTools {
  addKnowledge: (block: NewBrainBlock) => Promise<BrainBlock>;
  editKnowledge: (
    query: string,
    patch: { body: string; digest: string },
  ) => Promise<BrainBlock | null>;
  updateEssentials: (patch: ProjectPatch) => Promise<void>;
  /** Opens "Set up from a document" with this text already in it. */
  setUpFromDocument: (document: string) => void;
}

/** What the open idea canvas lets Chirpy do: take one instruction and change
 * the document, answering with what it did. */
export interface ChirpyCanvasTools {
  ask: (instruction: string) => Promise<NativeChirpyReply | null>;
}

interface StudioChirpyValue {
  open: (prompt?: string) => void;
  /** Opens the panel and sends this straight away. */
  run: (prompt: string) => void;
  registerBrainTools: (tools: ChirpyBrainTools | null) => void;
  registerCanvasTools: (tools: ChirpyCanvasTools | null) => void;
}

const StudioChirpyContext = createContext<StudioChirpyValue | null>(null);

const IDEA_COMMAND =
  /^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:create|make|bank|capture)\b.*\bidea\b/i;
const ADD_CONTEXT_COMMAND =
  /^(?:please\s+)?(?:add|remember|save|note)(?:\s+that)?\s+(.+)/i;
const EDIT_ESSENTIAL_COMMAND =
  /^(?:please\s+)?(?:change|update|edit|set)\b.*\b(voice|audience)\b.*?\bto\b\s+(.+)/i;
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
  const [previousPathname, setPreviousPathname] = useState(pathname);
  // Chirpy waits to be asked, Home included: the bird says hello there once
  // instead of covering the page with an open panel.
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChirpyMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [isNativeShell, setIsNativeShell] = useState(false);
  const brainTools = useRef<ChirpyBrainTools | null>(null);
  const canvasTools = useRef<ChirpyCanvasTools | null>(null);
  const nextID = useRef(1);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const [focusRequest, setFocusRequest] = useState(0);

  // A new surface starts with the panel put away.
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setIsOpen(false);
    setFocusRequest(0);
  }

  const append = useCallback(
    (message: Omit<ChirpyMessage, "id">) =>
      setMessages((current) => [
        ...current,
        { ...message, id: nextID.current++ },
      ]),
    [],
  );

  const open = useCallback((prompt?: string) => {
    const native = (window as NativeChirpyWindow).webkit?.messageHandlers
      ?.yapperNative;
    if (
      document.documentElement.hasAttribute("data-yapper-native-swift") &&
      native
    ) {
      native.postMessage({ command: "open_assistant", args: { prompt } });
      return;
    }
    setIsOpen(true);
    if (prompt) setDraft(prompt);
    setFocusRequest((count) => count + 1);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  }, []);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, working]);

  const registerBrainTools = useCallback((tools: ChirpyBrainTools | null) => {
    brainTools.current = tools;
  }, []);
  const registerCanvasTools = useCallback((tools: ChirpyCanvasTools | null) => {
    canvasTools.current = tools;
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
        if (isOpen) close();
        else open();
        return;
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close, open]);

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
          text: "I couldn’t confirm that save. Check your Knowledge before trying again.",
          tone: "trouble",
        });
      }
    },
    [addKnowledge, append],
  );

  const send = useCallback(
    async (raw: string, native?: NativeChirpyContext) => {
      // The tab the creator is on: the Mac app says so; on the web, the URL.
      const route = native?.surface ?? pathname;
      const text = raw.trim();
      if (!text || sending.current) return;
      sending.current = true;
      const answer = (message: Omit<ChirpyMessage, "id" | "author">) => {
        append({ author: "chirpy", ...message });
        return message;
      };
      setDraft("");
      append({ author: "you", text });
      setWorking(true);

      try {
        // On an idea's canvas, every ask is about the piece on screen: the
        // canvas writes it into the document and says what changed.
        if (canvasTools.current) {
          const reply = await canvasTools.current.ask(text);
          return answer(
            reply ?? {
              text: "I couldn’t change the canvas just now. Nothing was charged. Try again.",
              tone: "trouble",
            },
          );
        }
        // A long or multi-line message is a note or a transcript, never a typed
        // command; it goes straight to conversation.
        const command = looksLikeCommand(text);
        // A whole document about the creator is a Brain setup, not a chat.
        if (
          !command &&
          text.length >= 800 &&
          (route.startsWith("/studio/brain") ||
            /\b(brain|pillars?|audience|voice|content system|essentials)\b/i.test(
              text,
            ))
        ) {
          if (isNativeShell) {
            return answer({
              text: "That reads like your content system. Open Brain in Studio and use “Set up from a document” to fill your Essentials, pillars, and Knowledge from it.",
            });
          }
          if (brainTools.current) {
            brainTools.current.setUpFromDocument(text);
          } else {
            try {
              window.sessionStorage.setItem(SETUP_HANDOFF_KEY, text);
            } catch {
              // Session storage can be unavailable; the creator can paste
              // again on the Brain page.
            }
            startTransition(() => router.push("/studio/brain"));
          }
          return answer({
            text: "That reads like your content system, so I opened “Set up from a document” with it. Read it, tick what should land, and apply.",
            tone: "done",
          });
        }
        const brandCommand = command
          ? parseBrandCommand(
              text,
              route.startsWith("/studio/brand") ||
                messages.at(-1)?.brandColors !== undefined,
            )
          : null;
        if (brandCommand) {
          const reply = answer(await executeBrandCommand(brandCommand));
          if (reply.brandColors !== undefined)
            startTransition(() => router.push("/studio/brand"));
          return reply;
        }
        if (/^what can you help me (?:do here|with)\??$/i.test(text)) {
          return answer({
            text: "Tell me your brand colors and I’ll set up your kit. For example, ‘My brand colors are #FF7A21, black, and white’. I can also add Knowledge, create ideas from your Brain, and help shape your content.",
          });
        }
        if (command && IDEA_COMMAND.test(text)) {
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

        const essential = command ? text.match(EDIT_ESSENTIAL_COMMAND) : null;
        if (essential) {
          const [, field, value] = essential;
          const patch =
            field.toLowerCase() === "voice"
              ? { voice: value.trim() }
              : { audience: value.trim() };
          if (brainTools.current)
            await brainTools.current.updateEssentials(patch);
          else
            mutateClientResource(
              STUDIO_RESOURCE_KEYS.project,
              await patchProject(patch),
            );
          return answer({
            text: `Updated your ${field.toLowerCase()}.`,
            notes: ["Saved in Your Essentials"],
            tone: "done",
          });
        }

        const contextEdit = command ? text.match(EDIT_CONTEXT_COMMAND) : null;
        if (contextEdit) {
          const [, query, body] = contextEdit;
          const patch = {
            body: body.trim(),
            digest: titleFrom(body.trim()),
          };
          let changed: BrainBlock | null;
          if (brainTools.current)
            changed = await brainTools.current.editKnowledge(
              query.trim(),
              patch,
            );
          else {
            const found = findKnowledge(await listBlocks(), query.trim());
            changed = found ? await patchBlock(found.id, patch) : null;
          }
          return answer(
            changed
              ? {
                  text: `Updated “${changed.title}” in your Knowledge.`,
                  notes: ["Saved in Knowledge"],
                  tone: "done",
                }
              : {
                  text: `I couldn’t find Knowledge named “${query.trim()}”. Try its exact title, or ask me to add it instead.`,
                  tone: "trouble",
                },
          );
        }

        const context = command
          ? text.match(ADD_CONTEXT_COMMAND)?.[1]?.trim()
          : undefined;
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

        // The Mac app keeps one thread per tab and sends it; the web panel
        // has its own.
        const earlier = native?.history ?? messages;
        const conversation = earlier
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
      } catch (cause) {
        return answer({
          text:
            cause instanceof Error && cause.message === "knowledge_ambiguous"
              ? "More than one memory matches that name. Use its full, unique title so I update the right one."
              : cause instanceof Error && cause.message === "brand_color_limit"
                ? "Your kit can hold up to 8 colors. Remove a color first, then try adding this one."
                : "I couldn’t confirm that change. Check your saved work, then try again.",
          tone: "trouble",
        });
      } finally {
        window.dispatchEvent(new Event("studio:credits-changed"));
        sending.current = false;
        setWorking(false);
      }
    },
    [addKnowledge, append, isNativeShell, messages, pathname, router],
  );

  useEffect(() => {
    const nativeWindow = window as NativeChirpyWindow;
    const handler = async (
      instruction: string,
      context?: NativeChirpyContext,
    ): Promise<NativeChirpyReply> => {
      const reply = await send(instruction, context);
      if (!reply) throw new Error("Chirpy is already working");
      return reply;
    };
    nativeWindow.__yapperNativeChirpy = handler;
    return () => {
      if (nativeWindow.__yapperNativeChirpy === handler)
        delete nativeWindow.__yapperNativeChirpy;
    };
  }, [send]);

  const run = useCallback(
    (prompt: string) => {
      open();
      void send(prompt);
    },
    [open, send],
  );

  const value = useMemo(
    () => ({
      open,
      run,
      registerBrainTools,
      registerCanvasTools,
    }),
    [open, run, registerBrainTools, registerCanvasTools],
  );

  const lastTone = messages.at(-1)?.tone;
  const expression: ChirpyExpression = working
    ? "yap"
    : draft.trim()
      ? "curious"
      : lastTone === "trouble"
        ? "oops"
        : lastTone === "done"
          ? "happy"
          : "idle";
  const panel = (
    <ChirpyPanel
      pathname={pathname}
      expression={expression}
      working={working}
      messages={messages}
      draft={draft}
      onDraft={setDraft}
      focusRequest={focusRequest}
      onPickOpener={(prompt) => {
        setDraft(prompt);
        setFocusRequest((count) => count + 1);
      }}
      onSend={(text) => void send(text)}
      onSaveSuggestion={(suggestion) => void saveSuggestion(suggestion)}
      onClose={close}
    />
  );
  return (
    <StudioChirpyContext.Provider value={value}>
      {children}
      {isSignedIn && !isNativeShell ? (
        <ChirpyDock
          ref={launcher}
          open={isOpen}
          greetHere={pathname === "/studio/home"}
          expression={expression}
          working={working}
          panel={panel}
          onToggle={() => (isOpen ? close() : open())}
          onOpen={() => open()}
        />
      ) : null}
    </StudioChirpyContext.Provider>
  );
}
