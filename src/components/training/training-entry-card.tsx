import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TrainingEntryCard() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[#f7f2e8] shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#11141c] dark:shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="pointer-events-none absolute inset-0 opacity-[0.2]">
            <div className="absolute top-[-8rem] right-[-4rem] h-52 w-52 rounded-full bg-cyan-400 blur-3xl" />
            <div className="absolute bottom-[-8rem] left-[-4rem] h-52 w-52 rounded-full bg-orange-500 blur-3xl" />
          </div>
          <div className="relative">
            <p className="font-mono text-xs font-black tracking-[0.22em] text-cyan-700 uppercase dark:text-cyan-300/80">
              New training library
            </p>
            <h2 className="font-display mt-3 text-3xl leading-none font-black tracking-[-0.055em] text-slate-950 sm:text-5xl dark:text-white">
              Don’t just start the timer. Train the skill underneath it.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-white/64">
              Start with the Fluency on steroids protocol: four drills for word
              retrieval, vocal control, and summarizing under pressure. More
              protocols will plug into the same library over time.
            </p>
          </div>
          <Link
            href="/training"
            className="relative inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.2)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
          >
            Open training
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
