"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import PracticeStage from "@/components/practice-stage";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { DrillPrompt } from "@/data/drill-prompts";
import type { Topic } from "@/data/topics";

function pick(prompts: DrillPrompt[], current?: DrillPrompt) {
  const pool = current ? prompts.filter((p) => p.id !== current.id) : prompts;
  return pool[Math.floor(Math.random() * pool.length)] ?? prompts[0];
}

export default function ExplainAfterReadingFlow({
  prompts,
}: {
  prompts: DrillPrompt[];
}) {
  const [prompt, setPrompt] = useState(() => pick(prompts));
  const [revealed, setRevealed] = useState(true);
  const [key, setKey] = useState(0);
  const stagePrompt = useMemo<Topic>(
    () => ({
      id: prompt.id,
      text: `Explain in your own words: ${prompt.title}. ${prompt.focus}`,
      category: "General",
      difficulty: "Medium",
    }),
    [prompt],
  );
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <aside className="pt-2">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">
            Read → hide → explain
          </p>
          <h2 className="font-display mt-4 text-3xl leading-none font-black sm:text-4xl">
            {prompt.title}
          </h2>
          <p className="mt-2 text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
            {prompt.context}
          </p>
          <div className="mt-7 border-y border-slate-900/10 py-5 dark:border-white/10">
            {revealed ? (
              <p className="text-lg leading-8 font-bold">{prompt.text}</p>
            ) : (
              <p className="py-7 text-center text-sm font-bold text-slate-500 dark:text-white/42">
                Passage hidden. Explain the main idea from memory.
              </p>
            )}
          </div>
          <ol className="mt-6 space-y-3">
            {[
              "Read once slowly; do not memorize wording.",
              "Hide the passage and take 10 seconds to find the main idea.",
              "Explain the main idea, two details, and the takeaway in 60-90 seconds.",
              "If you blank, restart with: 'The point is...'",
            ].map((step, i) => (
              <li
                key={step}
                className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-white/64"
              >
                <span className="mt-1 text-xs font-black text-slate-400 tabular-nums dark:text-white/36">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-l-2 border-emerald-500/50 pl-4 text-sm leading-6 font-bold text-emerald-900 dark:text-emerald-100">
            Summarizing drills work best when you put the main idea and key
            details into your own words instead of reciting.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="cursor-pointer rounded-full border border-slate-900/12 bg-white/60 px-5 py-3 text-sm font-black transition-colors hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            >
              {revealed ? "Hide passage" : "Show passage"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPrompt((cur) => pick(prompts, cur));
                setRevealed(true);
                setKey((v) => v + 1);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              <RefreshCw className="h-4 w-4" />
              New passage
            </button>
          </div>
        </aside>
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/70 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
          <PracticeSessionProvider
            key={`${key}-${stagePrompt.id}`}
            initialTopic={stagePrompt}
          >
            <PracticeStage />
          </PracticeSessionProvider>
        </div>
      </div>
    </section>
  );
}
