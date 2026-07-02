"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { DrillContent } from "@/data/drills";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200/80 last:border-0 dark:border-white/[0.07]">
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-foreground pr-4 text-[14px] font-medium transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400">
          {q}
        </span>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
            open
              ? "rotate-45 bg-gray-900 dark:bg-white"
              : "bg-slate-100 dark:bg-white/10"
          }`}
        >
          <svg
            className={`h-3 w-3 transition-colors ${
              open
                ? "text-white dark:text-gray-900"
                : "text-slate-400 dark:text-slate-500"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="max-w-xl pb-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DrillSeoSections({ drill }: { drill: DrillContent }) {
  return (
    <section
      className="bg-background w-full px-4 py-20 md:px-8 md:py-24"
      aria-labelledby="drill-guide-heading"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* How it works */}
        <div className="mb-24 grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="lg:sticky lg:top-32"
          >
            <p
              className="text-xs font-semibold tracking-[0.15em] uppercase"
              style={{ color: "var(--sg-label)" }}
            >
              How it works
            </p>
            <h2
              id="drill-guide-heading"
              className="text-foreground mt-3 text-[32px] leading-[1.15] font-extrabold tracking-tight md:text-[42px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Three steps,
              <br />
              one clean rep.
            </h2>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
              {drill.heroEyebrow}. Free practice with an optional camera and
              mic, no sign-up.
            </p>
          </motion.div>

          <div className="relative flex flex-col gap-0">
            {drill.howItWorks.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative flex gap-5"
              >
                <div className="flex flex-col items-center">
                  <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[13px] font-semibold text-white dark:bg-white dark:text-gray-900">
                    {i + 1}
                  </div>
                  {i < drill.howItWorks.length - 1 && (
                    <div className="w-px flex-1 border-l-[1.5px] border-dashed border-slate-300 dark:border-slate-600" />
                  )}
                </div>
                <div className="flex-1 pb-10">
                  <h3 className="text-foreground text-[17px] font-bold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Why it works */}
        <div className="mb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <p
              className="text-xs font-semibold tracking-[0.15em] uppercase"
              style={{ color: "var(--sg-label)" }}
            >
              Why it works
            </p>
            <h2
              className="text-foreground mt-3 text-[32px] leading-[1.1] font-extrabold tracking-tight md:text-[42px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              What this rep builds.
            </h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-3">
            {drill.benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <h3 className="text-foreground text-[16px] font-bold tracking-tight">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {benefit.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
          >
            <p
              className="text-xs font-semibold tracking-[0.15em] uppercase"
              style={{ color: "var(--sg-label)" }}
            >
              FAQ
            </p>
            <h2
              className="mt-3 text-3xl leading-[1.1] font-bold tracking-[-0.02em] sm:text-[40px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Questions?
              <br />
              <span style={{ color: "var(--sg-display-muted)" }}>Answers.</span>
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            {drill.faq.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
