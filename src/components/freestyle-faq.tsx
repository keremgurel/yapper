"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const introSections: { title: string; body: string }[] = [
  {
    title: "How to use Freestyle mode",
    body: "Set your timer, turn on your camera and mic if you want a recording, and start speaking about whatever comes to mind. No topic prompt, no category to pick. Just you, a timer, and your voice. It is built for open-ended speaking practice with zero friction.",
  },
  {
    title: "Why freestyle practice helps",
    body: "Freestyle speaking builds natural confidence and flow. Without the pressure of a specific topic, you focus on how you speak instead of what to say. It is great for warming up, reducing filler words, and getting comfortable with your own voice.",
  },
  {
    title: "Private by default",
    body: "Your camera feed, mic input, and recordings stay in your browser. Nothing is uploaded to our servers, which makes Yapper a low-pressure way to practice speaking freely without an account or anyone watching.",
  },
];

const faqItems: { q: string; a: string }[] = [
  {
    q: "What is freestyle mode?",
    a: "Freestyle mode lets you practice speaking without a topic prompt. There is no random question or category to respond to. You simply set a timer, hit start, and talk about whatever you want. It is pure, unstructured speaking practice designed to help you get comfortable with thinking and talking on the spot.",
  },
  {
    q: "How is this different from random topic mode?",
    a: "In random topic mode, Yapper gives you a specific prompt to respond to, like a table topics question or a debate topic. Freestyle mode removes the prompt entirely. You decide what to talk about, or you just start talking and see where it goes. Both modes share the same timer, camera, and recording features.",
  },
  {
    q: "When should I use freestyle vs random topics?",
    a: "Use freestyle mode when you want to warm up, practice free-flowing speech, or work on delivery without worrying about content. Use random topics when you want structured practice responding to specific prompts, like preparing for interviews or Toastmasters table topics. Many speakers alternate between both.",
  },
  {
    q: "Can I still record in freestyle mode?",
    a: "Yes. Freestyle mode has the same camera and mic features as random topic mode. Turn on your camera and mic before you start, and your session will be recorded. You can download the recording when you finish, or skip it and the file is gone.",
  },
  {
    q: "What timer options are available?",
    a: "You can set the timer anywhere from 30 to 90 seconds, the same range as random topic mode. Use the rotary knob to adjust, or double-tap the timer display to type an exact number. 60 seconds is a good starting point for freestyle practice.",
  },
  {
    q: "Is freestyle mode free?",
    a: "Yes, completely free. No account, no subscription, and no credit card. Freestyle mode is part of the core Yapper experience and will always be free to use.",
  },
];

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

export function FreestyleFaq() {
  return (
    <section
      id="faq"
      className="bg-background w-full px-4 py-20 md:px-8 md:py-24"
      aria-labelledby="freestyle-guide-heading"
    >
      <div className="mx-auto max-w-5xl">
        {/* Intro cards */}
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-14">
          <h2
            id="freestyle-guide-heading"
            className="text-foreground mb-3 text-[24px] font-extrabold tracking-tight md:text-[34px]"
          >
            How to practice freestyle speaking with Yapper
          </h2>
          <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-slate-500 md:text-[16px] dark:text-slate-400">
            Use Yapper Freestyle to practice speaking freely with no topic
            prompt, just a timer and your voice.
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

        {/* FAQ */}
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold tracking-[0.15em] text-amber-600 uppercase dark:text-amber-400">
              FAQ
            </p>
            <h2
              className="mt-3 text-3xl leading-[1.1] font-bold tracking-[-0.02em] sm:text-[40px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Questions?
              <br />
              <span className="text-slate-400 dark:text-slate-500">
                Answers.
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            {faqItems.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
