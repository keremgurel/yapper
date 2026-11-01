"use client";

import {
  createContext,
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
import ChirpyPanel from "@/components/studio-shell/chirpy-panel";
import ChirpyDock from "@/components/studio-shell/chirpy-dock/chirpy-dock";
import type { ChirpyMessage } from "@/components/studio-shell/chirpy-message";
import { typedDecision } from "@/lib/chirpy/studio/typed-decision";
import type { StudioEffect } from "@/lib/chirpy/studio/wire";
import { useStudioTurn } from "@/components/studio-shell/use-studio-turn";
import type { ChirpyConfirmation } from "@/components/studio-shell/chirpy-message";

/** What the Mac's native thread shows. `effects` says which native stores to
 * reload; builds that predate it ignore it. */
type NativeChirpyReply = Pick<ChirpyMessage, "text" | "notes" | "tone"> & {
  effects?: StudioEffect[];
};
type SentReply = Omit<ChirpyMessage, "id" | "author"> & {
  effects?: StudioEffect[];
};

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

/** What the open idea canvas lets Chirpy do: take one instruction and change
 * the document, answering with what it did. */
export interface ChirpyCanvasTools {
  ask: (instruction: string) => Promise<NativeChirpyReply | null>;
}

interface StudioChirpyValue {
  open: (prompt?: string) => void;
  /** Opens the panel and sends this straight away. */
  run: (prompt: string) => void;
  registerCanvasTools: (tools: ChirpyCanvasTools | null) => void;
}

const StudioChirpyContext = createContext<StudioChirpyValue | null>(null);

/** The longest message a Studio turn reads, as the server checks it. */
const MESSAGE_MAX = 6000;

/** The panel's or a Mac tab's thread as model messages. A reply that was
 * only a question stands in as its question. */
function conversationFrom(
  thread: readonly {
    author: "you" | "chirpy";
    text: string;
    confirm?: { question: string };
  }[],
): { role: "user" | "assistant"; content: string }[] {
  return thread
    .map((message) => ({
      role:
        message.author === "you" ? ("user" as const) : ("assistant" as const),
      content: (message.text.trim() || message.confirm?.question || "").slice(
        0,
        6000,
      ),
    }))
    .filter((message) => message.content);
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

  const setConfirmState = useCallback(
    (executionID: string, state: ChirpyConfirmation["state"]) =>
      setMessages((current) =>
        current.map((message) =>
          message.confirm?.executionID === executionID
            ? { ...message, confirm: { ...message.confirm, state } }
            : message,
        ),
      ),
    [],
  );
  const studio = useStudioTurn(setConfirmState);

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

  const send = useCallback(
    async (
      raw: string,
      native?: NativeChirpyContext,
    ): Promise<SentReply | undefined> => {
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
        // A typed yes or no answers the open confirmation, as its buttons do.
        const decision = typedDecision(text);
        const waiting = messages.findLast(
          (message) => message.confirm?.state === "open",
        )?.confirm;
        if (decision && waiting) {
          const { effects, ...reply } = await studio.answer(
            waiting.executionID,
            decision,
          );
          return { ...answer(reply), effects };
        }
        if (/^what can you help me (?:do here|with)\??$/i.test(text)) {
          return answer({
            text: "Tell me your brand colors and I’ll set up your kit. For example, ‘My brand colors are #FF7A21, black, and white’. I can also answer questions from your Brain and change it, and make, file, schedule, rename or delete your ideas, like ‘make an idea about gym myths and put it on Friday’.",
          });
        }

        if (text.length > MESSAGE_MAX) {
          return answer({
            text: "That’s more than I can read in one message. For a long document or export, use “Fill in from” on the Brain tab, which reads whole files.",
            tone: "trouble",
          });
        }

        // Everything else is planned and run on the server with the Studio
        // actions, which answers with receipts and what to reload. Questions
        // about the creator are answered from their Brain there too.
        const { effects, ...reply } = await studio.ask(
          text,
          route,
          conversationFrom(native?.history ?? messages),
        );
        return { ...answer(reply), effects };
      } catch {
        return answer({
          text: "I couldn’t confirm that change. Check your saved work, then try again.",
          tone: "trouble",
        });
      } finally {
        window.dispatchEvent(new Event("studio:credits-changed"));
        sending.current = false;
        setWorking(false);
      }
    },
    [append, messages, pathname, studio],
  );

  useEffect(() => {
    const nativeWindow = window as NativeChirpyWindow;
    const handler = async (
      instruction: string,
      context?: NativeChirpyContext,
    ): Promise<NativeChirpyReply> => {
      const reply = await send(instruction, context);
      if (!reply) throw new Error("Chirpy is already working");
      // The native thread has no buttons: it shows the question and how to
      // answer it in words, which the next ask resolves.
      return {
        text: [reply.text, reply.confirm?.question, reply.confirm?.typedHint]
          .filter(Boolean)
          .join(" "),
        notes: reply.notes,
        tone: reply.tone,
        effects: reply.effects,
      };
    };
    nativeWindow.__yapperNativeChirpy = handler;
    return () => {
      if (nativeWindow.__yapperNativeChirpy === handler)
        delete nativeWindow.__yapperNativeChirpy;
    };
  }, [send]);

  /** A confirmation row's button: the same answer a typed yes or no gives. */
  const answerConfirmation = useCallback(
    async (executionID: string, decision: "confirm" | "cancel") => {
      setWorking(true);
      try {
        const reply = await studio.answer(executionID, decision);
        append({
          author: "chirpy",
          text: reply.text,
          notes: reply.notes,
          tone: reply.tone,
        });
      } finally {
        window.dispatchEvent(new Event("studio:credits-changed"));
        setWorking(false);
      }
    },
    [append, studio],
  );

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
      registerCanvasTools,
    }),
    [open, run, registerCanvasTools],
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
      onAnswerConfirmation={(executionID, decision) =>
        void answerConfirmation(executionID, decision)
      }
      onClose={close}
      conversationEnd={conversationEnd}
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
