import Link from "next/link";
import { ArrowRight } from "lucide-react";

import CreateIcon from "@/components/create/create-icon";
import TrainingHeader from "@/components/training/training-header";
import { createNav } from "@/data/create-nav";

export default function CreateHub() {
  return (
    <div className="bg-background min-h-screen">
      <TrainingHeader />

      <section className="px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
            Create with Yapper
          </p>
          <h1 className="font-display text-foreground mt-4 max-w-3xl text-5xl leading-[0.96] font-black text-balance sm:text-6xl">
            From a saved clip to a finished take.
          </h1>
          <p className="text-foreground/65 mt-5 max-w-2xl text-lg leading-8">
            Collect inspiration, shape it into an idea, record your take, and
            edit it by editing the transcript. Every step runs free in your
            browser — no account, nothing uploaded.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {createNav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border-border bg-card hover:border-foreground/20 flex flex-col rounded-3xl border p-6 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="border-border bg-muted text-foreground flex h-11 w-11 items-center justify-center rounded-2xl border">
                  <CreateIcon icon={item.icon} className="h-5 w-5" />
                </span>
                <span className="text-foreground/40 font-mono text-xs font-black tracking-[0.16em] uppercase">
                  {String(i + 1).padStart(2, "0")} · {item.step}
                </span>
              </div>
              <h2 className="text-foreground mt-5 text-2xl font-black tracking-tight">
                {item.title}
              </h2>
              <p className="text-foreground/60 mt-2 text-sm leading-6">
                {item.description}
              </p>
              <span className="text-foreground/70 group-hover:text-foreground mt-5 inline-flex items-center gap-1.5 text-sm font-black">
                Open
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
