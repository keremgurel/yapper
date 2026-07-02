import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import {
  fluencyProtocol,
  programFamilies,
  type ProgramFamily,
} from "@/data/training";

/* Category accent → design-system token. One source, no scattered palettes. */
const ACCENT: Record<ProgramFamily["accent"], string> = {
  cyan: "var(--sg-accent-2)",
  orange: "var(--sg-accent)",
  emerald: "var(--sg-green-500)",
  fuchsia: "var(--sg-pink-500)",
  amber: "var(--sg-yellow-500)",
  rose: "#f43f5e",
};

const muted = { color: "var(--sg-text-muted)" };

/* Three clear buckets, derived from the data. */
const OPEN_SLUGS = ["random-topic-generator", "freestyle-speech"];
const openPractice = OPEN_SLUGS.map(
  (slug) => programFamilies.find((p) => p.slug === slug)!,
);
const scenarios = programFamilies.filter(
  (p) => p.status === "Free now" && !OPEN_SLUGS.includes(p.slug),
);

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Pick a topic or drill",
    text: "A random prompt, a blank freestyle, or a specific scenario.",
  },
  {
    n: "2",
    title: "Talk to the timer",
    text: "Camera and mic are optional. Just start speaking when it counts down.",
  },
  {
    n: "3",
    title: "Play it back",
    text: "Review the take and spot exactly what to sharpen next time.",
  },
];

function ProgramCard({
  program,
  featured,
}: {
  program: ProgramFamily;
  featured?: boolean;
}) {
  return (
    <article className="sg-card flex flex-col gap-4 p-6">
      <span
        style={{
          height: 3,
          width: 40,
          borderRadius: 3,
          background: ACCENT[program.accent],
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {featured && (
          <span className="sg-chip">
            <span className="sg-chip-dot" />
            Start here
          </span>
        )}
        <span className="sg-chip">{program.duration}</span>
      </div>
      <div>
        <h3 className="sg-display text-2xl">{program.title}</h3>
        <p className="sg-label mt-2">{program.skill}</p>
      </div>
      <p className="text-sm leading-6" style={muted}>
        {program.prompt}
      </p>
      <Link
        href={program.href}
        className="sg-btn-ghost mt-auto self-start no-underline"
      >
        Start
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="sg-label" style={{ color: "var(--sg-label)" }}>
        {eyebrow}
      </p>
      <h2 className="sg-display mt-3 text-3xl sm:text-4xl">{title}</h2>
      {sub && (
        <p className="mt-3 text-base leading-7" style={muted}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function TrainingHub() {
  return (
    <TrainingLayout>
      {/* Hero — answers "what am I doing" up front */}
      <section className="px-4 pt-16 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="sg-chip">Training</span>
          <h1 className="sg-display mt-5 max-w-3xl text-5xl leading-[0.98] text-balance sm:text-6xl">
            What do you want to practice?
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8" style={muted}>
            Every drill is the same simple loop: a prompt, a timer, and a
            recording. Pick one below and start talking.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n} className="flex gap-4">
                <span
                  className="sg-display flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm"
                  style={{
                    background: "var(--sg-surface-sunken)",
                    color: "var(--sg-accent)",
                  }}
                >
                  {step.n}
                </span>
                <div>
                  <p className="sg-display text-base">{step.title}</p>
                  <p className="mt-1 text-sm leading-6" style={muted}>
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1. Start here — the two open modes */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Start here"
            title="Just open your mouth and go"
            sub="No setup. Pull a random topic, or free-talk to the camera about anything."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {openPractice.map((program, i) => (
              <ProgramCard
                key={program.slug}
                program={program}
                featured={i === 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 2. Scenarios — every category in one scannable grid */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Practice a real situation"
            title="Rehearse the moment that actually matters"
            sub="Same loop, focused prompts. Pick the situation you want to get better at."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scenarios.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Warm up — the fluency routine, framed as optional prep */}
      <section className="px-4 pt-10 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="sg-panel grid gap-8 p-8 lg:grid-cols-[1fr_1fr] lg:p-10">
            <div>
              <p className="sg-label" style={{ color: "var(--sg-label)" }}>
                Warm up first (optional)
              </p>
              <h2 className="sg-display mt-3 text-3xl sm:text-4xl">
                {fluencyProtocol.title}
              </h2>
              <p className="mt-3 text-base leading-7" style={muted}>
                {fluencyProtocol.promise}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="sg-chip">
                  <Clock3 className="h-4 w-4" />
                  {fluencyProtocol.duration}
                </span>
                <span className="sg-chip">
                  <CheckCircle2 className="h-4 w-4" />
                  {fluencyProtocol.cadence}
                </span>
              </div>
              <Link
                href="/training/fluency-on-steroids"
                className="sg-btn-accent mt-6 no-underline"
              >
                Open the warmup
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ol className="flex flex-col gap-3">
              {fluencyProtocol.drills.map((drill, index) => (
                <li
                  key={drill.id}
                  className="sg-sunken flex items-start gap-4 p-4"
                >
                  <span
                    className="sg-mono text-sm"
                    style={{ color: "var(--sg-text-faint)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="sg-display text-base">{drill.title}</p>
                    <p className="mt-1 text-sm leading-6" style={muted}>
                      {drill.outcome}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </TrainingLayout>
  );
}
