const faqItems: { q: string; a: string }[] = [
  {
    q: "Is Yapper really free?",
    a: "Yes — completely free. No account, no subscription, and no credit card. We built this so anyone can practice speaking without friction. If it helps you, that's enough.",
  },
  {
    q: "Do you store my video or audio?",
    a: "No. Nothing you say or record is uploaded to our servers or stored in the cloud. Your mic and camera stay entirely in your browser — we never see or keep your recordings.",
  },
  {
    q: "What happens to my recording after I practice?",
    a: "Only you can download it, and only right after you finish — if you want that file. If you skip download or close the tab, that recording is gone forever. No one else can replay it, and there's nothing to recover later. That's a feature: nothing at stake, so you can go for it.",
  },
  {
    q: "What is impromptu speaking practice?",
    a: "It's speaking off the cuff — you get a prompt, then you talk for a set time (e.g. 30–90 seconds) without a script. It's a widely used method for building public speaking confidence, performing in interviews, practicing ESL fluency, and thinking clearly under pressure. Yapper gives you random speech topics and a built-in timer so you can practice anytime, anywhere.",
  },
  {
    q: "Can I use this for Toastmasters table topics?",
    a: "Absolutely. Table topics are short impromptu speeches — exactly what Yapper is built for. Pull the lever for a random topic, set your timer to 1–2 minutes, and practice just like a meeting role without needing a club room. Many Toastmasters members use random generators like this to prep between meetings.",
  },
  {
    q: "Do I need to sign up or create an account?",
    a: "No. Open the page, optionally turn on camera or mic, set your timer, and hit Start. That's it — no forms, no email, no passwords.",
  },
  {
    q: "How does the random topic generator work?",
    a: "Yapper has hundreds of curated speech topics across categories like General, Technology, Business, Society, Fun, Debate, and Hot Takes — each with an Easy, Medium, or Hard difficulty level. Pull the lever (or tap Generate) and the slot machine picks one at random. You can filter by category or difficulty, or write your own prompt by double-tapping the topic card.",
  },
  {
    q: "Can I write my own speaking prompt?",
    a: "Yes. Before starting a session, double-tap the topic card to open the prompt editor. Type whatever you want to talk about — an interview question, a presentation topic, anything. Your custom prompt replaces the random one until you pull the lever again.",
  },
  {
    q: "What timer options are available?",
    a: "You can set the timer anywhere from 30 to 90 seconds using the rotary knob, or double-tap the timer display to type an exact number. 60 seconds is the default — a good sweet spot for impromptu speaking practice.",
  },
  {
    q: "Is this useful for practicing public speaking alone?",
    a: "That's exactly the scenario we designed for. Most people don't have an audience on demand. Yapper gives you a topic, a timer, and optionally a camera so you can practice solo — on your couch, at your desk, anywhere. It's the easiest way to practice public speaking alone without needing another person.",
  },
  {
    q: "Can I use Yapper on my phone?",
    a: "Yes. Yapper works in any modern mobile browser — Safari, Chrome, Firefox. The camera and mic features work on mobile too. No app download needed.",
  },
  {
    q: "Is this good for ESL or English speaking practice?",
    a: "Very much so. Yapper is used by English learners to practice fluency, reduce filler words, and build speaking confidence. The random topics force you to think and express ideas in English on the spot — which is exactly the skill IELTS, TOEFL, and CELPIP speaking sections test.",
  },
  {
    q: "How is Yapper different from other speech topic generators?",
    a: "Most random topic generators are just a list with a button. Yapper adds a built-in timer, optional camera and mic recording, difficulty levels, topic categories, custom prompts, and a privacy-first design where nothing leaves your browser. It's a complete practice environment, not just a list.",
  },
  {
    q: "Can I use Yapper for debate practice?",
    a: "Yes. We have a dedicated Debate category with topics designed to have two clear sides. Hot Takes is another great option for debate-style practice — the prompts are intentionally provocative to get you arguing a position.",
  },
  {
    q: "What are good 1-minute speech topics?",
    a: "Yapper generates hundreds of them across many categories. Set the timer to 60 seconds, pull the lever, and you'll get a topic perfectly scoped for a 1-minute impromptu speech — from lighthearted questions like 'What's the most overrated food?' to thought-provoking prompts like 'Should voting be mandatory?'",
  },
  {
    q: "Will Yapper add AI feedback or coaching in the future?",
    a: "We're exploring it. The free practice tool will always remain free. Future features like AI-powered speaking feedback, structured coaching for CELPIP/TOEFL prep, and progress tracking are on the roadmap — but the core random topic generator with timer and recording will stay free forever.",
  },
];

export function HomeFaq() {
  return (
    <section
      className="bg-background w-full px-4 py-14 md:px-8 md:py-20"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="faq-heading"
          className="text-foreground mb-2 text-center text-[22px] font-extrabold tracking-tight md:text-[26px]"
        >
          Frequently asked questions
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-center text-[14px] leading-relaxed text-slate-500 md:text-[15px] dark:text-slate-400">
          Straight answers about privacy, cost, and how Yapper fits your
          speaking practice.
        </p>
        <div className="divide-border divide-y rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm dark:border-white/[0.07] dark:bg-white/[0.025]">
          {faqItems.map((item) => (
            <details
              key={item.q}
              className="group transition-colors open:bg-slate-50/60 dark:open:bg-white/[0.03]"
            >
              <summary className="text-foreground hover:bg-muted/40 cursor-pointer list-none px-5 py-4 text-left text-[15px] font-semibold transition-colors [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <svg
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
