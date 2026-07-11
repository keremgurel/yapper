"use client";

import { ArrowRight, Check, Sparkles, TrendingUp } from "lucide-react";
import type { Coaching } from "@/lib/feedback/coach";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/40 rounded-xl border p-2.5">
      <div className="text-foreground text-sm font-black tabular-nums">
        {value}
      </div>
      <div className="text-foreground/50 text-[10px] font-bold tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}

/** Renders one completed audio-feedback result: score, coaching, and meters. */
export default function FeedbackResult({
  coaching: c,
  metrics: m,
}: {
  coaching: Coaching;
  metrics?: DeliveryMetrics;
}) {
  return (
    <div className="space-y-5">
      {/* Score + summary */}
      <div className="border-border bg-card rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--sg-accent)]/15 text-lg font-black text-[color:var(--sg-accent)] tabular-nums">
            {c.score}
          </div>
          <p className="text-foreground/80 text-[13px] leading-5">
            {c.summary}
          </p>
        </div>
      </div>

      {/* Meters (audio + full only) */}
      {m && (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Pace (wpm)" value={`${m.wpm}`} />
          <Metric label="Fillers / min" value={`${m.fillerPerMin}`} />
          <Metric label="Pauses" value={`${m.pauseCount}`} />
          <Metric
            label="Clarity"
            value={
              m.avgConfidence != null
                ? `${Math.round(m.avgConfidence * 100)}%`
                : "—"
            }
          />
        </div>
      )}

      {/* Strengths */}
      {c.strengths.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-foreground/50 flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Strengths
          </h3>
          {c.strengths.map((s, i) => (
            <p key={i} className="text-foreground/80 text-[13px] leading-5">
              {s}
            </p>
          ))}
        </section>
      )}

      {/* Improvements */}
      {c.improvements.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-foreground/50 flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Work on
          </h3>
          {c.improvements.map((s, i) => (
            <p key={i} className="text-foreground/80 text-[13px] leading-5">
              {s}
            </p>
          ))}
        </section>
      )}

      {/* Upgrade lines */}
      {c.upgradeLines.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-foreground/50 flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />{" "}
            Punch it up
          </h3>
          {c.upgradeLines.map((u, i) => (
            <div
              key={i}
              className="border-border bg-muted/30 space-y-1 rounded-xl border p-2.5"
            >
              <p className="text-foreground/45 text-[13px] leading-5 line-through">
                {u.before}
              </p>
              <p className="text-foreground flex items-start gap-1.5 text-[13px] leading-5 font-semibold">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--sg-accent)]" />
                {u.after}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
