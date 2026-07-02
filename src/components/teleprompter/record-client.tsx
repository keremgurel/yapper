"use client";

import { useEffect, useState } from "react";
import TeleprompterRecorder from "@/components/teleprompter/teleprompter-recorder";
import TeleprompterViewPicker from "@/components/teleprompter/teleprompter-view-picker";
import { loadIdeas, type Idea } from "@/lib/inspiration/ideas";
import {
  hasTeleprompterText,
  teleprompterText,
  type TeleprompterView,
} from "@/lib/teleprompter/script-view";

function defaultView(idea: Idea | null): TeleprompterView {
  if (idea && hasTeleprompterText(idea, "script") && idea.script?.trim()) {
    return "script";
  }
  if (idea && hasTeleprompterText(idea, "notes")) return "notes";
  return "off";
}

/**
 * Orchestrates the teleprompter recording flow. Reads the idea id from the URL
 * (ideas are local-first, so we resolve from localStorage rather than the
 * server) and steps: choose view → record. No idea → a freestyle take with the
 * prompt off.
 */
export default function RecordClient() {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<TeleprompterView>("off");
  const [phase, setPhase] = useState<"picker" | "recording">("picker");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("idea");
    const found = id ? (loadIdeas().find((i) => i.id === id) ?? null) : null;
    // One-time sync of the local-first idea from localStorage on mount; there's
    // no external system to subscribe to, so a direct set is correct here.
    /* eslint-disable react-hooks/set-state-in-effect */
    setIdea(found);
    setView(defaultView(found));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (!loaded) return <div className="min-h-screen" />;

  const available = (v: TeleprompterView) =>
    v === "off" ? true : idea ? hasTeleprompterText(idea, v) : false;
  const text = idea ? teleprompterText(idea, view) : "";

  return (
    <div className="bg-background min-h-screen">
      {phase === "picker" ? (
        <TeleprompterViewPicker
          title={idea?.title ?? ""}
          value={view}
          available={available}
          onSelect={setView}
          onStart={() => setPhase("recording")}
        />
      ) : (
        <TeleprompterRecorder text={text} onExit={() => setPhase("picker")} />
      )}
    </div>
  );
}
