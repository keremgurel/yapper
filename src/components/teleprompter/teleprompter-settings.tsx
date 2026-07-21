"use client";

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
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-w-9 flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors ${
            value === o.value
              ? "bg-white text-black"
              : "bg-white/15 text-white hover:bg-white/25"
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
    <div className="flex w-60 flex-col gap-3 rounded-xl bg-black/70 p-3 backdrop-blur-md">
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
