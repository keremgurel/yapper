import Link from "next/link";
import { ArrowRight, Clock3, Layers3, Repeat2 } from "lucide-react";
import { trainingProtocols } from "@/data/training";

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

export default function TrainingHub() {
  const protocol = trainingProtocols[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f2e8] text-slate-950 dark:bg-[#0f1117] dark:text-white">
      <section className="relative px-4 pt-24 pb-14 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-[0.26]">
          <div className="absolute top-[-14rem] left-[-10rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute right-[-10rem] bottom-[-16rem] h-[34rem] w-[34rem] rounded-full bg-orange-500 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.16)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.13)_1px,transparent_0)]" />
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
              href={protocol.blogHref}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white no-underline shadow-[0_14px_34px_rgba(15,23,42,0.2)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              Read the guide
            </Link>
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-[11px] font-black tracking-[0.22em] text-slate-600 uppercase shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-white/55">
                Training Library
              </div>
              <h1 className="font-display max-w-[760px] text-5xl leading-[0.9] font-black tracking-[-0.07em] text-balance sm:text-7xl lg:text-8xl">
                Drills for people who freeze mid-sentence.
              </h1>
            </div>

            <div className="max-w-xl lg:justify-self-end">
              <p className="text-lg leading-8 text-slate-700 dark:text-white/68">
                Yapper is not just prompts and a timer. Training is where we
                break speaking into repeatable drills: retrieval, voice,
                structure, confidence, recovery. Start with this protocol, then
                take it into a timed rep.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="#protocols"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
                >
                  Browse protocols
                </Link>
                <Link
                  href="/random-topic-generator"
                  className="rounded-full border border-slate-900/15 bg-white/55 px-5 py-3 text-sm font-bold text-slate-800 no-underline backdrop-blur transition-colors hover:bg-white dark:border-white/12 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12"
                >
                  Practice after drills
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="protocols" className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {trainingProtocols.map((item) => (
            <article
              key={item.slug}
              className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/72 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
            >
              <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-slate-900/10 p-6 sm:p-8 lg:border-r lg:border-b-0 dark:border-white/10">
                  <p className="font-mono text-xs font-bold tracking-[0.22em] text-cyan-700 uppercase dark:text-cyan-300/80">
                    {item.eyebrow}
                  </p>
                  <h2 className="font-display mt-8 text-4xl leading-none font-black tracking-[-0.055em] sm:text-6xl">
                    {item.title}
                  </h2>
                  <p className="mt-5 max-w-md text-base leading-7 text-slate-700 dark:text-white/65">
                    {item.description}
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                      <Clock3 className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                      <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                        Duration
                      </p>
                      <p className="mt-1 font-bold">{item.duration}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                      <Repeat2 className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                      <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                        Cadence
                      </p>
                      <p className="mt-1 font-bold">{item.cadence}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-black/18">
                      <Layers3 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      <p className="mt-3 text-xs font-bold text-slate-500 uppercase dark:text-white/38">
                        Drills
                      </p>
                      <p className="mt-1 font-bold">{item.drills.length}</p>
                    </div>
                  </div>

                  <p className="mt-8 rounded-2xl border border-slate-900/8 bg-white/60 p-4 text-sm leading-6 text-slate-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/62">
                    {item.promise}
                  </p>
                </div>

                <div className="grid gap-4 p-4 sm:p-6">
                  {item.drills.map((drill, index) => (
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

                      <h3 className="font-display mt-5 text-2xl leading-none font-black tracking-[-0.045em]">
                        {drill.title}
                      </h3>
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

                  <Link
                    href={item.blogHref}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white no-underline transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
                  >
                    Full breakdown
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
