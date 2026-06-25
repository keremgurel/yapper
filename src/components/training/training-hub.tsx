import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Flame,
  Map,
  Sparkles,
} from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import {
  fluencyProtocol,
  programFamilies,
  type ProgramFamily,
  type TrainingStatus,
} from "@/data/training";

const statusStyles: Record<TrainingStatus, string> = {
  "Free now":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  "Free guide":
    "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
};

const accentStyles: Record<ProgramFamily["accent"], string> = {
  cyan: "from-cyan-400/24 to-cyan-400/0",
  orange: "from-orange-400/24 to-orange-400/0",
  emerald: "from-emerald-400/24 to-emerald-400/0",
  fuchsia: "from-fuchsia-400/24 to-fuchsia-400/0",
  amber: "from-amber-400/24 to-amber-400/0",
  rose: "from-rose-400/24 to-rose-400/0",
};

const livePrograms = programFamilies.filter((program) =>
  ["random-topic-generator", "freestyle-speech"].includes(program.slug),
);
const guidedPrograms = programFamilies.filter(
  (program) =>
    program.status === "Free now" &&
    ![
      "random-topic-generator",
      "freestyle-speech",
      "creator-camera-drills",
    ].includes(program.slug),
);

function ProgramCard({ program }: { program: ProgramFamily }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-900/8 bg-white/68 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/8 dark:bg-white/[0.045] dark:shadow-none">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${accentStyles[program.accent]}`}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[program.status]}`}
          >
            {program.status}
          </span>
          <span className="rounded-full border border-slate-900/8 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-white/8 dark:text-white/42">
            {program.duration}
          </span>
        </div>
        <h3 className="font-display mt-5 text-2xl leading-none font-black">
          {program.title}
        </h3>
        <p className="mt-2 text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
          {program.skill}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-white/62">
          {program.prompt}
        </p>
        <p className="mt-4 rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 text-sm leading-6 font-bold dark:border-white/8 dark:bg-white/[0.035]">
          {program.sampleTask}
        </p>
        <Link
          href={program.href}
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black no-underline transition-transform hover:-translate-y-0.5 ${"bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}
        >
          Start
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default function TrainingHub() {
  return (
    <TrainingLayout>
      <section className="relative px-4 pt-16 pb-12 sm:px-6 sm:pt-20 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.22]">
          <div className="absolute top-[-12rem] left-[-8rem] h-[28rem] w-[28rem] rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute right-[-10rem] bottom-[-14rem] h-[30rem] w-[30rem] rounded-full bg-orange-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-slate-600 uppercase shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-white/55">
                <Map className="h-3.5 w-3.5" />
                Training map
              </div>
              <h1 className="font-display max-w-3xl text-5xl leading-[0.96] font-black text-balance sm:text-7xl sm:leading-[0.9]">
                Pick the speaking rep you need.
              </h1>
            </div>
            <div className="max-w-xl lg:justify-self-end">
              <p className="text-lg leading-8 text-slate-700 dark:text-white/68">
                Yapper is free random-topic and freestyle practice today. This
                hub keeps the training styles organized, marks what is live, and
                routes you back to the working practice flows.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/training/random-topic-generator"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
                >
                  Start random topic
                </Link>
                <Link
                  href="/training/freestyle-speech"
                  className="rounded-full border border-slate-900/15 bg-white/55 px-5 py-3 text-sm font-bold text-slate-800 no-underline backdrop-blur transition-colors hover:bg-white dark:border-white/12 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12"
                >
                  Start freestyle
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Camera,
                title: "Free practice",
                text: "Random topic generator and freestyle camera reps are live.",
              },
              {
                icon: Flame,
                title: "Free guide",
                text: "Fluency drills are available as a practical warmup guide.",
              },
              {
                icon: Sparkles,
                title: "Coming",
                text: "New guided programs are labeled as future, not active tools.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-900/8 bg-white/60 p-5 backdrop-blur dark:border-white/8 dark:bg-white/[0.05]"
              >
                <item.icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                <p className="mt-4 text-sm font-black">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/56">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="programs" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
                Free now
              </p>
              <h2 className="font-display mt-3 text-4xl leading-none font-black sm:text-5xl">
                Working practice flows.
              </h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {livePrograms.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_24px_90px_rgba(15,23,42,0.18)] dark:border-white/10">
          <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-white/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
              <p className="font-mono text-xs font-black tracking-[0.18em] text-emerald-200 uppercase">
                Free guide
              </p>
              <h2 className="font-display mt-5 text-4xl leading-none font-black sm:text-5xl">
                {fluencyProtocol.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-white/64">
                {fluencyProtocol.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-bold">
                  <Clock3 className="h-4 w-4" />
                  {fluencyProtocol.duration}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  {fluencyProtocol.cadence}
                </span>
              </div>
              <Link
                href="/training/fluency-on-steroids"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 no-underline transition-transform hover:-translate-y-0.5"
              >
                Open fluency drills
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2">
              {fluencyProtocol.drills.map((drill, index) => (
                <div
                  key={drill.id}
                  className="rounded-2xl bg-white/[0.065] p-5"
                >
                  <p className="font-mono text-xs font-black text-white/36">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-lg font-black">{drill.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    {drill.outcome}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <p className="font-mono text-xs font-black tracking-[0.18em] text-orange-700 uppercase dark:text-orange-300">
              Guided drills
            </p>
            <h2 className="font-display mt-3 text-4xl leading-none font-black sm:text-5xl">
              Useful categories, clearly marked.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-white/62">
              These are the next training styles in the product map. They are
              here for orientation only until the actual workflows exist.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guidedPrograms.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </div>
      </section>
    </TrainingLayout>
  );
}
