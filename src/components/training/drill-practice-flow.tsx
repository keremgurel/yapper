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
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-[2rem] border border-slate-900/10 bg-white/74 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055]">
          <p className="font-mono text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
            {eyebrow}
          </p>
          <h2 className="font-display mt-4 text-3xl leading-none font-black sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-white/62">
            {intro}
          </p>
          <div className="mt-6 rounded-2xl border border-slate-900/8 bg-slate-950/[0.035] p-4 dark:border-white/8 dark:bg-white/[0.035]">
            <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase dark:text-white/38">
              Current prompt
            </p>
            <p className="mt-3 text-lg leading-7 font-black">{prompt.text}</p>
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
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-black text-white dark:bg-white dark:text-slate-950">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          {prepNote && (
            <p className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 font-bold text-amber-900 dark:text-amber-100">
              {prepNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setPrompt((cur) => pick(prompts, cur));
              setKey((v) => v + 1);
            }}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950"
          >
            <RefreshCw className="h-4 w-4" />
            New prompt
          </button>
        </aside>
        <div className="rounded-[2rem] border border-slate-900/10 bg-slate-950/5 p-3 dark:border-white/10 dark:bg-white/[0.035]">
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
