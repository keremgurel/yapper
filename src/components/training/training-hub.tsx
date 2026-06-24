import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Clock3,
  Layers3,
  LibraryBig,
  Repeat2,
  WalletCards,
} from "lucide-react";
import {
  fluencyProtocol,
  inspirationFeatures,
  programFamilies,
  trainingProtocols,
  type ProgramFamily,
  type TrainingStatus,
} from "@/data/training";

const categoryStyles = {
  Mindset:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  Retrieval:
    "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  Voice:
    "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  Structure:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
};

const statusStyles: Record<TrainingStatus, string> = {
  "Free now":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  Coming: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  "Credits later":
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

const accentStyles: Record<ProgramFamily["accent"], string> = {
  cyan: "from-cyan-400/22 to-cyan-400/0",
  orange: "from-orange-400/22 to-orange-400/0",
  emerald: "from-emerald-400/22 to-emerald-400/0",
  fuchsia: "from-fuchsia-400/22 to-fuchsia-400/0",
  amber: "from-amber-400/22 to-amber-400/0",
  rose: "from-rose-400/22 to-rose-400/0",
};

export default function TrainingHub() {
  const protocol = trainingProtocols[0];
  const freePrograms = programFamilies.filter(
    (family) => family.status === "Free now",
  );
  const comingPrograms = programFamilies.filter(
    (family) => family.status !== "Free now",
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f2e8] text-slate-950 dark:bg-[#0f1117] dark:text-white">
      <section className="relative px-4 pt-24 pb-16 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.2] dark:opacity-[0.24]">
          <div className="absolute top-[-14rem] left-[-10rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute right-[-10rem] bottom-[-16rem] h-[34rem] w-[34rem] rounded-full bg-orange-500 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.14)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/65 px-3 py-2 text-sm font-bold text-slate-700 no-underline backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/12"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-xs font-black text-white">
                Y
              </span>
              yapper
            </Link>
            <Link
              href="/random-topic-generator"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white no-underline shadow-[0_14px_34px_rgba(15,23,42,0.2)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              Free practice
            </Link>
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-slate-600 uppercase shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-white/55">
                Training programs
              </div>
              <h1 className="font-display max-w-[800px] text-5xl leading-[0.98] font-black text-balance sm:text-7xl sm:leading-[0.9] lg:text-8xl">
                Training programs for every kind of yap.
              </h1>
            </div>

            <div className="max-w-xl lg:justify-self-end">
              <p className="text-lg leading-8 text-slate-700 dark:text-white/68">
                Yapper starts with free random-topic and freestyle camera reps.
                This page maps the bigger library: explain-after-reading,
                read-aloud delivery, interviews, social reps, conflict, creator
                drills, and the live fluency warmup.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="#program-map"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
                >
                  Browse programs
                </Link>
                <Link
                  href="#live-protocol"
                  className="rounded-full border border-slate-900/15 bg-white/55 px-5 py-3 text-sm font-bold text-slate-800 no-underline backdrop-blur transition-colors hover:bg-white dark:border-white/12 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12"
                >
                  See live protocol
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Camera,
                label: "Free now",
                title: "Random topic, freestyle, and Fluency on steroids",
              },
              {
                icon: LibraryBig,
                label: "Coming",
                title: "Programs and Inspiration Lab workflows",
              },
              {
                icon: WalletCards,
                label: "Credits later",
                title:
                  "Task feedback bought per review, not bundled into free reps",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-900/8 bg-white/60 p-5 backdrop-blur dark:border-white/8 dark:bg-white/[0.05]"
              >
                <item.icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                <p className="mt-5 text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-6 font-bold">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="program-map" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="font-mono text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
                Program map
              </p>
              <h2 className="font-display mt-4 text-4xl leading-none font-black sm:text-6xl">
                What you will be able to train.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-700 dark:text-white/64">
                Every family has a skill, a prompt style, and a concrete task.
                Only free-now items are positioned as available.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[...freePrograms, ...comingPrograms].map((family) => (
                <article
                  key={family.slug}
                  className="relative overflow-hidden rounded-[1.5rem] border border-slate-900/8 bg-white/68 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/8 dark:bg-black/18 dark:shadow-none"
                >
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accentStyles[family.accent]}`}
                  />
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[family.status]}`}
                      >
                        {family.status}
                      </span>
                      <span className="rounded-full border border-slate-900/8 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-white/8 dark:text-white/42">
                        {family.duration}
                      </span>
                    </div>
                    <h3 className="font-display mt-5 text-2xl leading-none font-black">
                      {family.title}
                    </h3>
                    <p className="mt-2 text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
                      {family.skill}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-white/62">
                      {family.prompt}
                    </p>
                    <div className="mt-5 rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-white/[0.035]">
                      <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
                        Sample task
                      </p>
                      <p className="mt-2 text-sm leading-6 font-bold">
                        {family.sampleTask}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-900/8 bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8 dark:border-white/8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-black tracking-[0.18em] text-orange-200 uppercase">
              Inspiration Lab preview
            </p>
            <h2 className="font-display mt-4 text-4xl leading-none font-black sm:text-6xl">
              Save clips. Pull patterns. Record better yaps.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/62">
              The Lab is a future workspace for creator inspiration. It is not
              link ingestion yet; it is the product direction for turning saved
              videos into practice prompts.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {inspirationFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
              >
                <h3 className="text-sm font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="live-protocol"
        className="relative px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs font-black tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">
                Live protocol
              </p>
              <h2 className="font-display mt-4 text-4xl leading-none font-black sm:text-6xl">
                {fluencyProtocol.title}
              </h2>
            </div>
            <Link
              href={protocol.blogHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              Full breakdown
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <article className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/72 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-slate-900/10 p-6 sm:p-8 lg:border-r lg:border-b-0 dark:border-white/10">
                <p className="font-mono text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300/80">
                  {protocol.eyebrow} · Free now
                </p>
                <h3 className="font-display mt-8 text-4xl leading-none font-black sm:text-6xl">
                  {protocol.title}
                </h3>
                <p className="mt-5 max-w-md text-base leading-7 text-slate-700 dark:text-white/65">
                  {protocol.description}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                    <Clock3 className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                    <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                      Duration
                    </p>
                    <p className="mt-1 font-bold">{protocol.duration}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                    <Repeat2 className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                    <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                      Cadence
                    </p>
                    <p className="mt-1 font-bold">{protocol.cadence}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                    <Layers3 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                    <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                      Drills
                    </p>
                    <p className="mt-1 font-bold">{protocol.drills.length}</p>
                  </div>
                </div>

                <p className="mt-8 rounded-2xl border border-slate-900/8 bg-white/60 p-4 text-sm leading-6 text-slate-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/62">
                  {protocol.promise}
                </p>
              </div>

              <div className="grid gap-4 p-4 sm:p-6">
                {protocol.drills.map((drill, index) => (
                  <section
                    key={drill.id}
                    className="group rounded-[1.5rem] border border-slate-900/8 bg-white/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/8 dark:bg-black/18 dark:hover:bg-white/[0.075]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-950 px-2.5 py-1 font-mono text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-black tracking-[0.14em] uppercase ${categoryStyles[drill.category]}`}
                      >
                        {drill.category}
                      </span>
                      <span className="rounded-full border border-slate-900/8 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-white/8 dark:text-white/42">
                        {drill.duration}
                      </span>
                    </div>

                    <h4 className="font-display mt-5 text-2xl leading-none font-black">
                      {drill.title}
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-white/64">
                      {drill.outcome}
                    </p>

                    <details className="mt-4 rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-white/[0.035]">
                      <summary className="cursor-pointer text-sm font-black text-slate-900 dark:text-white">
                        Drill instructions
                      </summary>
                      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-white/64">
                        {drill.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <p className="mt-4 text-sm leading-6 text-slate-600 italic dark:text-white/50">
                        {drill.cue}
                      </p>
                      <p className="mt-3 text-xs leading-5 font-bold text-red-700/80 dark:text-red-200/70">
                        Avoid: {drill.avoid}
                      </p>
                    </details>
                  </section>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-slate-900/10 bg-white/62 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 dark:border-white/10 dark:bg-white/[0.05]">
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="font-mono text-xs font-black tracking-[0.18em] text-amber-700 uppercase dark:text-amber-300">
                How feedback will work later
              </p>
              <h2 className="font-display mt-4 text-3xl leading-none font-black sm:text-5xl">
                Record a task. Spend credits. Get one fix.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Pick a guided task and record the attempt.",
                "Spend credits only when you want feedback.",
                "Get one specific fix, then repeat the task.",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18"
                >
                  <p className="font-mono text-xs font-black text-slate-500 dark:text-white/38">
                    0{index + 1}
                  </p>
                  <p className="mt-3 text-sm leading-6 font-bold">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/random-topic-generator"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              Start free random topic
            </Link>
            <Link
              href="/freestyle-speech"
              className="rounded-full border border-slate-900/15 bg-white/55 px-5 py-3 text-sm font-black text-slate-800 no-underline backdrop-blur transition-colors hover:bg-white dark:border-white/12 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12"
            >
              Start freestyle
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
