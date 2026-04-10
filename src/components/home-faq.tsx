"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { getFaqSection1, getFaqSection2 } from "@/data/faq";

const introSections: { title: string; body: string }[] = [
  {
    title: "How to use Yapper",
    body: "Turn on your camera and mic first if you want a recording, then pick a category, set your timer, pull the lever, and start speaking. It is built for impromptu speaking practice, public speaking alone, and quick table topics reps with zero setup.",
  },
  {
    title: "Why people use it",
    body: "Yapper is a random topic generator made for real speaking practice, not just browsing prompts. Use it for impromptu speech topics, interview speaking practice, 1 minute speech topics, English speaking confidence, or Toastmasters table topics between meetings.",
  },
  {
    title: "Private by default",
    body: "Your speech topics, camera feed, mic input, and recordings stay in your browser. Nothing is uploaded to our servers, which makes Yapper a low-pressure way to practice public speaking online without an account or a coach watching.",
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
      <div className="mx-auto max-w-5xl">
        {/* Intro cards */}
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-14">
          <h2
            id="practice-guide-heading"
            className="text-foreground mb-3 text-[24px] font-extrabold tracking-tight md:text-[34px]"
          >
            How to practice impromptu speaking with Yapper
          </h2>
          <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-slate-500 md:text-[16px] dark:text-slate-400">
            Use Yapper as a random topic generator for impromptu speaking
            practice, table topics, and public speaking practice online.
          </p>
        </div>

        <div className="mb-24 grid gap-4 md:grid-cols-3 md:gap-5">
          {introSections.map((section) => (
            <article
              key={section.title}
              className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-white/[0.07] dark:bg-white/[0.025]"
            >
              <h3 className="text-foreground mb-3 text-[18px] font-bold tracking-tight md:text-[20px]">
                {section.title}
              </h3>
              <p className="text-[14px] leading-7 text-slate-600 dark:text-slate-400">
                {section.body}
              </p>
            </article>
          ))}
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
