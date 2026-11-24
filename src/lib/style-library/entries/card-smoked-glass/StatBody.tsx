import type { ContentValues } from "../../format/content-spec";
import { ink } from "../../shared/ink";
import type { GlassContentSpecs } from "./content";

type Stat = ContentValues<GlassContentSpecs>;

const TONE: Record<Stat["tone"], string> = {
  neutral: ink.text,
  cost: ink.cost,
  value: ink.value,
};

const secondary = { fontSize: 30, fontWeight: 700, color: ink.muted } as const;

/** A number said once: a small label, the value, and a line of detail. */
export function StatBody({ label, value, detail, tone }: Stat) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      {label ? <div style={secondary}>{label}</div> : null}
      {value ? (
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
            color: TONE[tone],
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
      ) : null}
      {detail ? (
        <div style={{ ...secondary, fontSize: 26, fontWeight: 600 }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}
