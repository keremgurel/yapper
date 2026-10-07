"use client";

import { Liquid } from "liquid-gooey";
import { useState } from "react";

import {
  FONT_SCALES,
  HEIGHTS,
  LEAD_INS,
  OPACITIES,
  type TeleprompterSettings,
} from "@/hooks/use-teleprompter-settings";

function Seg<T extends number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [animate, setAnimate] = useState(false);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div className="relative isolate flex gap-1">
      <Liquid
        fill="#fff"
        blur={4}
        contrast={18}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <Liquid.Item effect="move">
          <div
            className={
              animate
                ? "motion-safe:transition-transform motion-safe:duration-150"
                : ""
            }
            style={{
              position: "absolute",
              width: `${100 / options.length}%`,
              height: "100%",
              borderRadius: 6,
              transform: `translateX(${index * 100}%)`,
            }}
          />
        </Liquid.Item>
      </Liquid>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={(event) => {
            setAnimate(event.detail !== 0);
            onChange(o.value);
          }}
          aria-pressed={value === o.value}
          className={`relative z-10 min-w-9 flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors ${
            value === o.value ? "text-black" : "text-white hover:bg-white/15"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-white/70">{label}</span>
      {children}
    </div>
  );
}

/**
 * The teleprompter look-and-feel panel: text size, on-screen height, shade
 * opacity, and a lead-in delay. Presentational — the parent owns the settings
 * and the patch handler.
 */
export default function TeleprompterSettingsPanel({
  settings,
  onChange,
}: {
  settings: TeleprompterSettings;
  onChange: (patch: Partial<TeleprompterSettings>) => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-black/70 p-3 backdrop-blur-md">
      <Row label="Text size">
        <Seg
          options={FONT_SCALES}
          value={settings.fontScale}
          onChange={(v) => onChange({ fontScale: v })}
        />
      </Row>
      <Row label="Height">
        <Seg
          options={HEIGHTS}
          value={settings.heightPct}
          onChange={(v) => onChange({ heightPct: v })}
        />
      </Row>
      <Row label="Shade">
        <Seg
          options={OPACITIES}
          value={settings.opacity}
          onChange={(v) => onChange({ opacity: v })}
        />
      </Row>
      <Row label="Lead-in">
        <Seg
          options={LEAD_INS.map((s) => ({ value: s, label: `${s}s` }))}
          value={settings.leadInSec}
          onChange={(v) => onChange({ leadInSec: v })}
        />
      </Row>
    </div>
  );
}
