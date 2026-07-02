import Link from "next/link";
import { ArrowRight } from "lucide-react";

import CreateIcon from "@/components/create/create-icon";
import TrainingHeader from "@/components/training/training-header";
import { createNav } from "@/data/create-nav";

export default function CreateHub() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--sg-bg)", color: "var(--sg-text)" }}
    >
      <TrainingHeader />

      <section className="px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="sg-label" style={{ color: "var(--sg-label)" }}>
            Create with Yapper
          </p>
          <h1 className="sg-display mt-4 max-w-3xl text-5xl leading-[0.96] text-balance sm:text-6xl">
            From a saved clip to a finished take.
          </h1>
          <p
            className="mt-5 max-w-2xl text-lg leading-8"
            style={{ color: "var(--sg-text-muted)" }}
          >
            Collect inspiration, shape it into an idea, record your take, and
            edit it by editing the transcript. Every step runs free in your
            browser, no account, nothing uploaded.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {createNav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="sg-card group flex flex-col p-6 no-underline transition-all duration-300 hover:-translate-y-0.5"
              style={{ color: "var(--sg-text)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    background: "var(--sg-surface-sunken)",
                    border: "1px solid var(--sg-border)",
                    color: "var(--sg-accent)",
                  }}
                >
                  <CreateIcon icon={item.icon} className="h-5 w-5" />
                </span>
                <span
                  className="sg-mono text-xs font-black tracking-[0.16em] uppercase"
                  style={{ color: "var(--sg-text-faint)" }}
                >
                  {String(i + 1).padStart(2, "0")} · {item.step}
                </span>
              </div>
              <h2 className="sg-display mt-5 text-2xl">{item.title}</h2>
              <p
                className="mt-2 text-sm leading-6"
                style={{ color: "var(--sg-text-muted)" }}
              >
                {item.description}
              </p>
              <span
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: "var(--sg-accent)" }}
              >
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
