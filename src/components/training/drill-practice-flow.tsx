"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import PracticeStage from "@/components/practice-stage";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

function pick(prompts: Topic[], current?: Topic) {
  const pool = current ? prompts.filter((p) => p.id !== current.id) : prompts;
  return pool[Math.floor(Math.random() * pool.length)] ?? prompts[0];
}

export default function DrillPracticeFlow({
  eyebrow,
  title,
  intro,
  prompts,
  instructions,
  suggestedTime,
  prepNote,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  prompts: Topic[];
  instructions: string[];
  suggestedTime: string;
  prepNote?: string;
}) {
  const [prompt, setPrompt] = useState(() => pick(prompts));
  const [key, setKey] = useState(0);
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <aside className="pt-2">
          <p className="text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
            {eyebrow}
          </p>
          <h2 className="font-display mt-4 text-3xl leading-none font-black sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-white/62">
            {intro}
          </p>
          <div className="mt-7 border-y border-slate-900/10 py-5 dark:border-white/10">
            <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
              Current prompt
            </p>
            <p className="mt-3 text-xl leading-8 font-black">{prompt.text}</p>
            <p className="mt-3 text-xs font-bold text-slate-500 dark:text-white/42">
              {prompt.category} · {prompt.difficulty} · {suggestedTime}
            </p>
          </div>
          <ol className="mt-6 space-y-3">
            {instructions.map((step, i) => (
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
          {prepNote && (
            <p className="mt-5 border-l-2 border-amber-500/50 pl-4 text-sm leading-6 font-bold text-amber-900 dark:text-amber-100">
              {prepNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setPrompt((cur) => pick(prompts, cur));
              setKey((v) => v + 1);
            }}
            className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
          >
            <RefreshCw className="h-4 w-4" />
            New prompt
          </button>
        </aside>
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/70 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
          <PracticeSessionProvider
            key={`${key}-${prompt.id}`}
            initialTopic={prompt}
          >
            <PracticeStage />
          </PracticeSessionProvider>
        </div>
      </div>
    </section>
  );
}
