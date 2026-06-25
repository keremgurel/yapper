import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TrainingEntryCard() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl border-y border-slate-900/10 py-8 dark:border-white/10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black tracking-[0.22em] text-cyan-700 uppercase dark:text-cyan-300/80">
              Training programs
            </p>
            <h2 className="font-display mt-3 text-3xl leading-none font-black tracking-[-0.055em] text-slate-950 sm:text-5xl dark:text-white">
              Structured reps for every speaking mode.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-white/64">
              Pick a drill, get a focused prompt, and record a clean rep with
              the same timer and practice flow Yapper uses everywhere.
            </p>
          </div>
          <Link
            href="/training"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
          >
            Open training
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
