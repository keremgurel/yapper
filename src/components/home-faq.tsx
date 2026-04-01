"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

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

const faqSection1: { q: string; a: string }[] = [
  {
    q: "Is Yapper really free?",
    a: "Yes, completely free. No account, no subscription, and no credit card. We built this so anyone can practice speaking without friction. If it helps you, that is enough.",
  },
  {
    q: "Do you store my video or audio?",
    a: "No. Nothing you say or record is uploaded to our servers or stored in the cloud. Your mic and camera stay entirely in your browser, and we never see or keep your recordings.",
  },
  {
    q: "What happens to my recording after I practice?",
    a: "Only you can download it, and only after you finish if you want that file. If you skip download or close the tab, that recording is gone forever. No one else can replay it, and there is nothing to recover later. That is a feature, because nothing is at stake and you can go for it.",
  },
  {
    q: "What is impromptu speaking practice?",
    a: "It is speaking off the cuff. You get a prompt, then you talk for a set time, such as 30 to 90 seconds, without a script. It is a widely used method for building public speaking confidence, performing in interviews, practicing ESL fluency, and thinking clearly under pressure. Yapper gives you random speech topics and a built-in timer so you can practice anytime, anywhere.",
  },
  {
    q: "Can I use this for Toastmasters table topics?",
    a: "Absolutely. Table topics are short impromptu speeches, and that is exactly what Yapper is built for. Pull the lever for a random topic, set your timer to 1 to 2 minutes, and practice just like a meeting role without needing a club room. Many Toastmasters members use random generators like this to prep between meetings.",
  },
  {
    q: "Do I need to sign up or create an account?",
    a: "No. Open the page, turn on camera or mic if you want, set your timer, and hit Start. That is it. No forms, no email, and no passwords.",
  },
  {
    q: "How does the random topic generator work?",
    a: "Yapper has hundreds of curated speech topics across categories like General, Technology, Business, Society, Fun, Debate, and Hot Takes, each with an Easy, Medium, or Hard difficulty level. Pull the lever and the slot machine picks one at random. You can filter by category or difficulty, or write your own prompt by double-tapping the topic card.",
  },
  {
    q: "Can I write my own speaking prompt?",
    a: "Yes. Before starting a session, double-tap the topic card to open the prompt editor. Type whatever you want to talk about, whether that is an interview question, a presentation topic, or anything else. Your custom prompt replaces the random one until you pull the lever again.",
  },
];

const faqSection2: { q: string; a: string }[] = [
  {
    q: "What timer options are available?",
    a: "You can set the timer anywhere from 30 to 90 seconds using the rotary knob, or double-tap the timer display to type an exact number. 60 seconds is the default, and it is a good sweet spot for impromptu speaking practice.",
  },
  {
    q: "Is this useful for practicing public speaking alone?",
    a: "That is exactly the scenario we designed for. Most people do not have an audience on demand. Yapper gives you a topic, a timer, and optionally a camera so you can practice solo on your couch, at your desk, or anywhere else. It is one of the easiest ways to practice public speaking alone without needing another person.",
  },
  {
    q: "Can I use Yapper on my phone?",
    a: "Yes. Yapper works in any modern mobile browser, including Safari, Chrome, and Firefox. The camera and mic features work on mobile too. No app download is needed.",
  },
  {
    q: "Is this good for ESL or English speaking practice?",
    a: "Very much so. Yapper is used by English learners to practice fluency, reduce filler words, and build speaking confidence. The random topics force you to think and express ideas in English on the spot, which is exactly the skill IELTS, TOEFL, and CELPIP speaking sections test.",
  },
  {
    q: "How is Yapper different from other speech topic generators?",
    a: "Most random topic generators are just a list with a button. Yapper adds a built-in timer, optional camera and mic recording, difficulty levels, topic categories, custom prompts, and a privacy-first design where nothing leaves your browser. It is a complete practice environment, not just a list.",
  },
  {
    q: "Can I use Yapper for debate practice?",
    a: "Yes. We have a dedicated Debate category with topics designed to have two clear sides. Hot Takes is another great option for debate-style practice because the prompts are intentionally provocative and push you to argue a position.",
  },
  {
    q: "What are good 1-minute speech topics?",
    a: "Yapper generates hundreds of them across many categories. Set the timer to 60 seconds, pull the lever, and you will get a topic that is well scoped for a 1-minute impromptu speech, from lighthearted questions like 'What is the most overrated food?' to thought-provoking prompts like 'Should voting be mandatory?'",
  },
  {
    q: "Will Yapper add AI feedback or coaching in the future?",
    a: "We are exploring it. The free practice tool will always remain free. Future features like AI-powered speaking feedback, structured coaching for CELPIP or TOEFL prep, and progress tracking are on the roadmap, but the core random topic generator with timer and recording will stay free.",
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
