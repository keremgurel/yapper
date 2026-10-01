"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Liquid } from "liquid-gooey";
import { useReducedMotion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import TeleprompterOverlay from "@/components/teleprompter/teleprompter-overlay";
import { useTeleprompterScroll } from "@/hooks/use-teleprompter-scroll";
import { HEIGHTS, OPACITIES } from "@/hooks/use-teleprompter-settings";
import { useDemoPlayback } from "./use-demo-playback";
import { demoHook, demoScript } from "./demo-content";

const DEMO_FONT_SCALES = [
  { label: "S", value: 0.5 },
  { label: "M", value: 0.64 },
  { label: "L", value: 0.78 },
  { label: "XL", value: 0.92 },
] as const;

function LiquidOptions({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: number }[];
  value: number;
  onChange: (value: number) => void;
}) {
  const reduced = useReducedMotion();
  const index = options.findIndex((option) => option.value === value);
  return (
    <fieldset className="prompter-control">
      <legend>{label}</legend>
      <Liquid
        fill="var(--sg-text)"
        blur={4}
        contrast={20}
        className="prompter-segments"
      >
        <Liquid.Item
          effect="move"
          move={{ stretch: reduced ? 0 : 0.35, trail: reduced ? 0 : 0.18 }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <div
            className="prompter-segment-indicator"
            style={{
              width: `calc((100% - 8px) / ${options.length})`,
              transform: `translateX(${index * 100}%)`,
              transition: reduced ? "none" : "transform 220ms ease",
            }}
          />
        </Liquid.Item>
        <div
          className="prompter-segment-buttons"
          style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Liquid>
    </fieldset>
  );
}

function LiquidSpeed({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="prompter-control">
      <div className="prompter-speed-label">
        <label htmlFor={id}>Reading speed</label>
        <output htmlFor={id}>
          {value} <span>wpm</span>
        </output>
      </div>
      <div ref={track} className="prompter-speed">
        <Liquid
          fill="var(--sg-text)"
          blur={4}
          contrast={20}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <div className="prompter-speed-track" />
          <Liquid.Item
            effect="move"
            move={{ stretch: reduced ? 0 : 0.45, trail: reduced ? 0 : 0.2 }}
          >
            <div
              className="prompter-speed-thumb"
              style={{
                transform: `translateX(${((value - 60) / 180) * Math.max(0, width - 22)}px)`,
              }}
            />
          </Liquid.Item>
        </Liquid>
        <input
          id={id}
          type="range"
          min={60}
          max={240}
          step={5}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={`${value} words per minute`}
        />
      </div>
      <div className="prompter-speed-extents">
        <span>Take it slow</span>
        <span>Pick up the pace</span>
      </div>
    </div>
  );
}

export default function TeleprompterPreview() {
  const { ref, inView, reducedMotion } = useDemoPlayback(1);
  const [fontScale, setFontScale] = useState(0.64);
  const [heightPct, setHeightPct] = useState(44);
  const [opacity, setOpacity] = useState(0.75);
  const [paused, setPaused] = useState(false);
  const [manualStart, setManualStart] = useState(false);
  const { scrollRef, wpm, setWpm, running, play, pause, reset } =
    useTeleprompterScroll(fontScale);
  const canPlay = inView && !paused && (!reducedMotion || manualStart);
  useEffect(() => {
    if (canPlay) play();
    else pause();
  }, [canPlay, play, pause]);
  const toggle = () => {
    if (running) {
      setPaused(true);
      pause();
    } else {
      const el = scrollRef.current;
      if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) reset();
      setPaused(false);
      setManualStart(true);
      play();
    }
  };
  return (
    <div ref={ref} className="prompter-demo">
      <div className="prompter-demo-controls">
        <h2>Find your reading pace.</h2>
        <p>Try it here. Adjust the script as it scrolls.</p>
        <LiquidSpeed value={wpm} onChange={setWpm} />
        <LiquidOptions
          label="Text size"
          options={DEMO_FONT_SCALES}
          value={fontScale}
          onChange={setFontScale}
        />
        <LiquidOptions
          label="Prompt height"
          options={HEIGHTS}
          value={heightPct}
          onChange={setHeightPct}
        />
        <LiquidOptions
          label="Background shade"
          options={OPACITIES}
          value={opacity}
          onChange={setOpacity}
        />
        <div className="prompter-demo-actions">
          <button type="button" onClick={toggle}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? "Pause scrolling" : "Start scrolling"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              if (canPlay) play();
            }}
          >
            <RotateCcw size={14} />
            Start over
          </button>
        </div>
      </div>
      <div className="prompter-demo-camera">
        <div className="prompter-demo-frame">
          <Image
            src="/images/marketing/creator-studio.webp"
            alt="Creator reading to camera"
            fill
            sizes="(max-width: 640px) 320px, 400px"
          />
          <TeleprompterOverlay
            scrollRef={scrollRef}
            text={`${demoHook}\n\n${demoScript}`}
            fontScale={fontScale}
            heightPct={heightPct}
            opacity={opacity}
          />
        </div>
      </div>
    </div>
  );
}
