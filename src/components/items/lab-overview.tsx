import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Mic2,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { ContentSummary } from "@/lib/content/client";

type Mode = "ideas" | "library";

const COPY = {
  ideas: {
    eyebrow: "Creative inbox",
    title: "Never lose the spark.",
    description:
      "Catch rough thoughts, voice notes, and references before they disappear. Yapper keeps the source, finds the angle, and lets you decide what deserves to be made.",
    steps: [
      {
        icon: Mic2,
        label: "Capture",
        detail: "Type, dictate, or paste a link",
      },
      {
        icon: WandSparkles,
        label: "Enrich",
        detail: "Get angles, hooks, and context",
      },
      {
        icon: ArrowRight,
        label: "Promote",
        detail: "Send the keepers to your library",
      },
    ],
  },
  library: {
    eyebrow: "Production pipeline",
    title: "Know what to make next.",
    description:
      "Turn chosen ideas into shoot-ready scripts, keep every take attached to its story, and move the work from draft to published without losing the thread.",
    steps: [
      { icon: Sparkles, label: "Shape", detail: "Develop the hook and script" },
      { icon: Mic2, label: "Record", detail: "Shoot from the same workspace" },
      { icon: Send, label: "Publish", detail: "Schedule and post everywhere" },
    ],
  },
} as const;

/** A map of what each Lab surface is for, grounded in live workspace numbers. */
export default function LabOverview({
  mode,
  items,
  action,
}: {
  mode: Mode;
  items: ContentSummary[] | null;
  action?: React.ReactNode;
}) {
  const copy = COPY[mode];
  const metrics = mode === "ideas" ? ideaMetrics(items) : libraryMetrics(items);

  return (
    <section className="relative mb-8 overflow-hidden rounded-[28px_4px_28px_28px] border border-[color:var(--sg-border-strong)] bg-[color:var(--sg-surface)] shadow-[var(--sg-shadow-panel)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 9% 12%, color-mix(in srgb, var(--sg-accent) 18%, transparent), transparent 31%), radial-gradient(circle at 82% 120%, color-mix(in srgb, var(--sg-accent-2) 13%, transparent), transparent 34%)",
        }}
      />

      <div className="relative grid gap-8 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-12 lg:px-10">
        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[color:var(--sg-accent-strong)] uppercase">
                {copy.eyebrow}
              </p>
              {action}
            </div>
            <h1 className="font-display text-foreground max-w-[12ch] text-[clamp(2.35rem,5vw,4.75rem)] leading-[0.92] font-semibold tracking-[-0.065em]">
              {copy.title}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-[61ch] text-[15px] leading-7">
              {copy.description}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-3 divide-x divide-[color:var(--sg-border)] border-t border-[color:var(--sg-border)] pt-5">
            {metrics.map((metric) => (
              <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
                <p className="font-display text-foreground text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                  {metric.value}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px] leading-4 font-semibold tracking-[0.04em] uppercase">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="self-end rounded-[20px_4px_20px_20px] border border-white/50 bg-[color:color-mix(in_srgb,var(--sg-surface-raised)_78%,transparent)] p-3 shadow-[var(--sg-shadow-card)] backdrop-blur-xl dark:border-white/8">
          <div className="flex items-center gap-2 px-2 pt-1 pb-3">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--sg-accent)]" />
            <p className="text-foreground text-xs font-bold tracking-[0.1em] uppercase">
              The Yapper loop
            </p>
          </div>
          <ol className="space-y-1">
            {copy.steps.map(({ icon: Icon, label, detail }, index) => (
              <li
                key={label}
                className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[color:var(--sg-surface-sunken)]"
              >
                <span className="text-muted-foreground w-5 text-[10px] font-bold tabular-nums">
                  0{index + 1}
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:color-mix(in_srgb,var(--sg-accent)_12%,transparent)] text-[color:var(--sg-accent-strong)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-bold">
                    {label}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function LabSwitchLink({ mode }: { mode: Mode }) {
  const ideas = mode === "ideas";
  return (
    <Link
      href={ideas ? "/studio/library" : "/studio/ideas"}
      className="text-foreground hover:bg-muted inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--sg-border-strong)] bg-[color:var(--sg-surface)] px-3 text-xs font-bold shadow-sm transition-colors"
    >
      {ideas ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Lightbulb className="h-3.5 w-3.5" />
      )}
      {ideas ? "View pipeline" : "Open Idea Bank"}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function ideaMetrics(items: ContentSummary[] | null) {
  if (items === null)
    return loadingMetrics(["ideas", "with sources", "enriched"]);
  return [
    { value: String(items.length), label: "ideas" },
    {
      value: String(items.filter((item) => item.sourceUrl).length),
      label: "with sources",
    },
    {
      value: String(
        items.filter(
          (item) =>
            item.title.trim() && (item.formats.length > 0 || item.ideaType),
        ).length,
      ),
      label: "enriched",
    },
  ];
}

function libraryMetrics(items: ContentSummary[] | null) {
  if (items === null)
    return loadingMetrics(["in pipeline", "scripted", "published"]);
  return [
    { value: String(items.length), label: "in pipeline" },
    {
      value: String(items.filter((item) => item.script?.trim()).length),
      label: "scripted",
    },
    {
      value: String(items.filter((item) => item.status === "posted").length),
      label: "published",
    },
  ];
}

function loadingMetrics(labels: string[]) {
  return labels.map((label) => ({ value: "—", label }));
}
