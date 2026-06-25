import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Mic2, Sparkles } from "lucide-react";

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
      <section className="px-4 pt-16 pb-12 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-slate-600 uppercase shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-white/55">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPractice ? "Practice available now" : "Free guide"}
            </div>
            <h1 className="font-display max-w-4xl text-5xl leading-[0.96] font-black text-balance sm:text-7xl sm:leading-[0.9]">
              {program.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 dark:text-white/68">
              {program.prompt}
            </p>
          </div>
          <div className="rounded-[2rem] border border-slate-900/10 bg-white/72 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
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
            <p className="mt-5 rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 text-sm leading-6 font-bold dark:border-white/8 dark:bg-white/[0.035]">
              {program.sampleTask}
            </p>
            <Link
              href={program.href}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.2)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              {isPractice ? "Open drill" : "Open guide"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            {
              title: isPractice ? "Real practice flow" : "Practical guide",
              text: isPractice
                ? "This drill has a prompt bank, timer, and optional camera/mic recording flow."
                : "This page is a working written protocol you can run immediately.",
              icon: Mic2,
            },
            {
              title: "When to use it",
              text: program.prompt,
              icon: Sparkles,
            },
            {
              title: "Typical rep",
              text: program.sampleTask,
              icon: CheckCircle2,
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-900/8 bg-white/64 p-5 dark:border-white/8 dark:bg-white/[0.05]"
            >
              <item.icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
              <h2 className="mt-4 text-base font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/56">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {children}
    </TrainingLayout>
  );
}
