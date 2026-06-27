import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import { fluencyProtocol } from "@/data/training";

export const metadata: Metadata = {
  title: "Fluency on Steroids Speaking Drills",
  description:
    "A practical four-drill warmup for faster word retrieval, smoother vocal control, and cleaner summaries before speaking practice.",
  alternates: {
    canonical: "https://ypr.app/training/fluency-on-steroids",
  },
};

export default function FluencyOnSteroidsPage() {
  return (
    <TrainingLayout>
      <section className="px-4 pt-14 pb-8 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-black tracking-[0.08em] text-cyan-700 uppercase dark:text-cyan-200">
              Free guide
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 px-3 py-1.5 text-[11px] font-black text-slate-600 dark:border-white/10 dark:text-white/56">
              <Clock3 className="h-3.5 w-3.5" />
              {fluencyProtocol.duration}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 px-3 py-1.5 text-[11px] font-black text-slate-600 dark:border-white/10 dark:text-white/56">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {fluencyProtocol.cadence}
            </span>
          </div>
          <h1 className="font-display mt-6 max-w-4xl text-5xl leading-[0.96] font-black text-balance sm:text-7xl sm:leading-[0.9]">
            {fluencyProtocol.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700 dark:text-white/68">
            {fluencyProtocol.description}
          </p>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-900/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-8 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-white/68">
              {fluencyProtocol.promise}
            </p>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/training/random-topic-generator"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
              >
                Warm up, then random topic
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={fluencyProtocol.blogHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-900/12 px-5 py-3 text-sm font-black text-slate-700 no-underline transition-colors hover:bg-slate-950/[0.04] dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Read blog version
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {fluencyProtocol.drills.map((drill, index) => (
            <article
              key={drill.id}
              className="rounded-[1.75rem] border border-slate-900/10 bg-white/72 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-slate-400 dark:text-white/32">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full border border-slate-900/10 px-2.5 py-1 text-[11px] font-black text-slate-500 uppercase dark:border-white/10 dark:text-white/42">
                  {drill.category}
                </span>
                <span className="rounded-full border border-slate-900/10 px-2.5 py-1 text-[11px] font-black text-slate-500 uppercase dark:border-white/10 dark:text-white/42">
                  {drill.duration}
                </span>
              </div>
              <h2 className="font-display mt-5 text-3xl leading-none font-black">
                {drill.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-white/62">
                {drill.outcome}
              </p>
              <ol className="mt-5 space-y-3">
                {drill.steps.map((step) => (
                  <li
                    key={step}
                    className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-white/64"
                  >
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-2xl bg-slate-950/[0.045] p-4 text-sm leading-6 font-bold dark:bg-white/[0.045]">
                Cue: {drill.cue}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-white/42">
                Avoid: {drill.avoid}
              </p>
            </article>
          ))}
        </div>
      </section>
    </TrainingLayout>
  );
}
