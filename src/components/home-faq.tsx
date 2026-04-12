"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { getFaqSection1, getFaqSection2 } from "@/data/faq";

const steps: { title: string; body: string; image: string }[] = [
  {
    title: "Pick your mode",
    body: "Choose between random topics or freestyle mode. Set your timer, turn on your camera and mic if you want a recording, and get ready to speak.",
    image: "/step-pick-mode.png",
  },
  {
    title: "Pull the lever",
    body: "Hit the generate button to get a random speech topic. Use it for impromptu speech topics, interview practice, table topics, or 1-minute speech prompts.",
    image: "/step-pull-lever.png",
  },
  {
    title: "Start speaking",
    body: "Everything stays in your browser. No uploads, no accounts, no coach watching. Just a low-pressure way to practice public speaking online.",
    image: "/step-start-speaking.png",
  },
];

const faqSection1 = getFaqSection1();
const faqSection2 = getFaqSection2();

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

function FaqBlock({
  label,
  heading,
  headingAccent,
  items,
}: {
  label: string;
  heading: string;
  headingAccent: string;
  items: { q: string; a: string }[];
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-semibold tracking-[0.15em] text-amber-600 uppercase dark:text-amber-400">
          {label}
        </p>
        <h2
          className="mt-3 text-3xl leading-[1.1] font-bold tracking-[-0.02em] sm:text-[40px]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          {heading}
          <br />
          <span className="text-slate-400 dark:text-slate-500">
            {headingAccent}
          </span>
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.08 }}
      >
        {items.map((item) => (
          <FaqItem key={item.q} {...item} />
        ))}
      </motion.div>
    </div>
  );
}

export function HomeFaq() {
  return (
    <section
      className="bg-background w-full px-4 py-20 md:px-8 md:py-24"
      aria-labelledby="practice-guide-heading"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Steps timeline */}
        <div className="mb-24 grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          {/* Left heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="lg:sticky lg:top-32"
          >
            <h2
              id="practice-guide-heading"
              className="text-foreground text-[32px] leading-[1.15] font-extrabold tracking-tight md:text-[42px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Get started in
              <br />3 simple steps.
            </h2>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
              Use Yapper as a random topic generator for impromptu speaking
              practice, table topics, and public speaking practice online.
            </p>
          </motion.div>

          {/* Right timeline */}
          <div className="relative flex flex-col gap-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative flex gap-5"
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  {/* Number circle */}
                  <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[13px] font-semibold text-white dark:bg-white dark:text-gray-900">
                    {i + 1}
                  </div>
                  {/* Dashed connector */}
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 border-l-[1.5px] border-dashed border-slate-300 dark:border-slate-600" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 pb-12">
                  {/* Visual card */}
                  <div className="relative mb-6 overflow-hidden rounded-2xl">
                    <Image
                      src={step.image}
                      alt={step.title}
                      width={600}
                      height={400}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground text-[17px] font-bold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {step.body}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* FAQ Section 1 */}
        <FaqBlock
          label="FAQ"
          heading="Questions?"
          headingAccent="Answers."
          items={faqSection1}
        />

        {/* FAQ Section 2 */}
        <div className="mt-20">
          <FaqBlock
            label="Still curious?"
            heading="Keep asking."
            headingAccent="We don't mind."
            items={faqSection2}
          />
        </div>
      </div>
    </section>
  );
}
