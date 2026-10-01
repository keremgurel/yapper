"use client";

import { useEffect, useId, useRef } from "react";
import { Check, Mic } from "lucide-react";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import HookChosen from "@/components/canvas/hooks/hook-chosen";
import HookAlternatives from "@/components/canvas/hooks/hook-alternatives";
import ScriptEditor from "@/components/canvas/script-editor";
import DemoDictation from "./demo-dictation";
import {
  demoHook,
  demoHooks,
  demoScript,
  demoRevisedScript,
} from "./demo-content";
import { useDemoPlayback } from "./use-demo-playback";

const noop = () => {};
export function WritingScene({
  frame,
  playing,
  compact = false,
}: {
  frame: number;
  playing: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const conversation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = conversation.current;
    if (node)
      node.scrollTo({
        top: frame >= 6 && frame < 8 ? node.scrollHeight : 0,
        behavior: playing ? "smooth" : "instant",
      });
  }, [frame, playing]);
  const choosing = frame >= 4 && frame < 8;
  const revising = frame >= 8;
  const updated = frame >= 12;
  const thinking = frame === 3 || frame === 11;
  const speaking = frame === 1 || frame === 2 || frame === 9 || frame === 10;
  const message = revising
    ? "Use the first hook. Make the rest shorter and more conversational."
    : "Give me three stronger hooks. Keep it sounding like me.";
  const spoken =
    frame === 1
      ? "Give me three stronger hooks…"
      : frame === 9
        ? "Use the first hook. Make the rest shorter…"
        : message;
  return (
    <div
      className={`writing-demo${compact ? "writing-demo-compact" : ""}`}
      data-playing={playing}
      data-updated={updated}
      role="img"
      aria-label="Chirpy writing demonstration: ask by voice for three alternative hooks, select the first, and ask for a shorter, more conversational script. The hook and script update together."
    >
      <div
        className="writing-demo-document studio-document"
        inert
        aria-hidden="true"
      >
        <HookChosen
          hook={frame >= 8 ? demoHooks[0] : demoHook}
          hookKey={`${id}-chosen`}
          onChange={noop}
          onAskForHooks={noop}
        />
        <div className="writing-demo-script">
          <ScriptEditor
            text={updated ? demoRevisedScript : demoScript}
            onChange={noop}
            onWrite={noop}
            onAsk={noop}
            minHeight={210}
          />
        </div>
        <div className="writing-demo-applied" data-visible={updated}>
          <Check size={13} /> Hook and script updated
        </div>
      </div>
      <div className="writing-demo-assistant" aria-hidden="true">
        <div className="writing-demo-chirpy">
          <ChirpyMark size={27} />
          <strong>Chirpy</strong>
          <span>Your writing partner</span>
        </div>
        <div className="writing-demo-conversation" ref={conversation}>
          {frame >= 3 && (
            <div className="writing-demo-you">
              <Mic size={12} />
              <p>{message}</p>
            </div>
          )}
          {frame < 3 && (
            <p className="writing-demo-welcome">
              Keep your point. Find a better way to say it.
            </p>
          )}
          {thinking && (
            <div className="writing-demo-thinking">
              {revising ? "Tightening your script" : "Finding your opening"}
              <span>…</span>
            </div>
          )}
          {choosing && (
            <div className="writing-demo-options" inert>
              <HookAlternatives
                hooks={demoHooks}
                keys={demoHooks.map((_, i) => `${id}-${i}`)}
                onUse={noop}
                onRemove={noop}
                onMore={noop}
              />
            </div>
          )}
          {revising && !thinking && (
            <div className="writing-demo-reply">
              {updated
                ? "Done. A sharper opening, shorter sentences, and the same story in your own voice."
                : "The first hook is in. Let’s tighten the rest."}
            </div>
          )}
        </div>
        <DemoDictation
          text={speaking ? spoken : ""}
          active={playing && speaking}
          frame={frame}
          placeholder={
            updated
              ? "What would you like to change next?"
              : "Ask Chirpy to shape your script…"
          }
        />
      </div>
    </div>
  );
}
export default function WritingPreview() {
  const { ref, frame, active } = useDemoPlayback(17, 1600);
  return (
    <div ref={ref}>
      <WritingScene frame={frame} playing={active} />
    </div>
  );
}
