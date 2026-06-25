import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import type { ProgramFamily, TrainingStatus } from "@/data/training";

const statusStyles: Record<TrainingStatus, string> = {
  "Free now":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  "Free guide":
    "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
};

export default function TrainingPageShell({
  program,
  children,
}: {
  program: ProgramFamily;
  children?: React.ReactNode;
}) {
  const isPractice = program.status === "Free now";

  return (
    <TrainingLayout>
      <section className="px-4 pt-16 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/60 px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-slate-600 uppercase backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPractice ? "Practice ready" : "Practice guide"}
            </div>
            <h1 className="font-display max-w-4xl text-5xl leading-[0.96] font-black text-balance sm:text-7xl sm:leading-[0.9]">
              {program.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 dark:text-white/68">
              {program.prompt}
            </p>
          </div>
          <aside className="border-t border-slate-900/10 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-white/10">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${statusStyles[program.status]}`}
              >
                {program.status}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 px-3 py-1.5 text-xs font-black text-slate-600 dark:border-white/10 dark:text-white/56">
                <Clock3 className="h-3.5 w-3.5" />
                {program.duration}
              </span>
            </div>
            <p className="mt-6 text-xs font-black tracking-[0.16em] text-slate-500 uppercase dark:text-white/38">
              Trains
            </p>
            <p className="mt-2 text-2xl leading-tight font-black">
              {program.skill}
            </p>
            <p className="mt-5 border-l-2 border-slate-950/15 pl-4 text-sm leading-6 font-bold text-slate-700 dark:border-white/20 dark:text-white/62">
              {program.sampleTask}
            </p>
            <Link
              href={program.href}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              {isPractice ? "Start drill" : "Open guide"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </section>

      {children}
    </TrainingLayout>
  );
}
