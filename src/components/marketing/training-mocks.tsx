import { Check, Mic, Sparkles } from "lucide-react";

/**
 * Small, honest renderings of the training surfaces, for the homepage
 * showcase. They are built from the same tokens as the real screens and show
 * output the product genuinely produces, so nothing here promises something a
 * visitor will not find.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]">
      <div className="border-border bg-muted flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <span className="text-muted-foreground ml-2 text-[11px] font-semibold">
          Yapper
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PromptMock() {
  return (
    <Frame>
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.14em] uppercase">
        Your prompt
      </p>
      <p className="text-foreground mt-3 text-[19px] leading-snug font-semibold">
        Describe a time you changed your mind about something important.
      </p>
      <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
        <span className="font-mono text-[28px] font-semibold text-[color:var(--sg-accent)] tabular-nums">
          1:00
        </span>
        <span className="bg-muted text-foreground inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
          <Mic className="h-3.5 w-3.5" />
          Recording
        </span>
      </div>
    </Frame>
  );
}

export function ScoreMock() {
  const rows: [string, number][] = [
    ["Clarity", 78],
    ["Grammar", 64],
    ["Vocabulary", 71],
    ["Delivery", 83],
    ["Impact", 69],
  ];
  return (
    <Frame>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-[color:var(--sg-cyan-500)] font-mono text-[22px] font-semibold tabular-nums">
          74
        </span>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          You made the point, but it arrived third. Lead with it next time and
          the rest of the answer earns its place.
        </p>
      </div>
      <div className="mt-5 space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0 text-[12px]">
              {label}
            </span>
            <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <span
                className="block h-full rounded-full bg-[color:var(--sg-cyan-500)]"
                style={{ width: `${value}%` }}
              />
            </span>
            <span className="text-foreground w-7 text-right font-mono text-[12px] tabular-nums">
              {value}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function CorrectionsMock() {
  return (
    <Frame>
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.14em] uppercase">
        What you said
      </p>
      <p className="text-foreground mt-3 text-[15px] leading-[1.9]">
        So basically I{" "}
        <span className="rounded bg-yellow-500/20 px-1 underline decoration-yellow-500/70 decoration-wavy underline-offset-4">
          was thinking
        </span>{" "}
        that we should of{" "}
        <span className="rounded bg-yellow-500/20 px-1 underline decoration-yellow-500/70 decoration-wavy underline-offset-4">
          went
        </span>{" "}
        with the other one, um, because it&apos;s more{" "}
        <span className="rounded bg-yellow-500/20 px-1 underline decoration-yellow-500/70 decoration-wavy underline-offset-4">
          good
        </span>
        .
      </p>
      <div className="border-border mt-5 space-y-2 border-t pt-4">
        {[
          [
            "should of went",
            "should have gone",
            "Past modal takes have plus the participle.",
          ],
          ["more good", "better", "Good has an irregular comparative."],
        ].map(([before, after, note]) => (
          <div key={before} className="text-[13px]">
            <span className="text-muted-foreground line-through">{before}</span>
            <span className="text-foreground mx-2 font-semibold">{after}</span>
            <span className="text-muted-foreground">{note}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function PolishedMock() {
  return (
    <Frame>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-[color:var(--sg-violet-500)] uppercase">
        <Sparkles className="h-3.5 w-3.5" />
        Cleaner version
      </p>
      <p className="text-foreground mt-3 text-[15px] leading-[1.9]">
        I&apos;d been leaning the other way, and I think we should have gone
        with it, because it holds up better over time.
      </p>
      <p className="text-muted-foreground border-border mt-5 flex items-start gap-2 border-t pt-4 text-[13px] leading-relaxed">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--sg-green-500)]" />
        Your ideas, your structure, said the way you were reaching for.
      </p>
    </Frame>
  );
}
