const SITE = "https://ypr.app";

const faqEntries: { name: string; text: string }[] = [
  {
    name: "Is Yapper really free?",
    text: "Yes — completely free. No account, no subscription, and no credit card.",
  },
  {
    name: "Do you store my video or audio?",
    text: "No. Nothing is uploaded or stored. Your mic and camera stay entirely in your browser.",
  },
  {
    name: "What happens to my recording after I practice?",
    text: "Only you can download it right after finishing. If you skip, the recording is gone forever.",
  },
  {
    name: "What is impromptu speaking practice?",
    text: "Speaking off the cuff with a random prompt and a timer — useful for public speaking, interviews, ESL practice, and building confidence.",
  },
  {
    name: "Can I use this for Toastmasters table topics?",
    text: "Yes. Table topics are short impromptu speeches — Yapper provides random topics and a timer for solo practice.",
  },
  {
    name: "Do I need to sign up or create an account?",
    text: "No. Open the page and start practicing without an account, email, or password.",
  },
  {
    name: "How does the random topic generator work?",
    text: "Yapper has hundreds of curated speech topics across categories and difficulty levels. Pull the lever to pick one at random, or filter by category.",
  },
  {
    name: "Can I write my own speaking prompt?",
    text: "Yes. Double-tap the topic card before a session to type your own prompt.",
  },
  {
    name: "What timer options are available?",
    text: "Set the timer from 30 to 90 seconds using the rotary knob or by double-tapping the display to type a value.",
  },
  {
    name: "Is this useful for practicing public speaking alone?",
    text: "Yes — Yapper gives you a topic, a timer, and an optional camera so you can practice solo anywhere.",
  },
  {
    name: "Can I use Yapper on my phone?",
    text: "Yes. Yapper works in any modern mobile browser with camera and mic support. No app download needed.",
  },
  {
    name: "Is this good for ESL or English speaking practice?",
    text: "Yes. Random topics force you to think and express ideas in English on the spot — the exact skill IELTS, TOEFL, and CELPIP speaking tests measure.",
  },
  {
    name: "How is Yapper different from other speech topic generators?",
    text: "Yapper adds a built-in timer, optional camera/mic recording, difficulty levels, custom prompts, and a privacy-first design — a complete practice environment, not just a list.",
  },
  {
    name: "Can I use Yapper for debate practice?",
    text: "Yes. Dedicated Debate and Hot Takes categories provide topics designed for arguing a position.",
  },
  {
    name: "What are good 1-minute speech topics?",
    text: "Yapper generates hundreds — set the timer to 60 seconds, pull the lever, and get a topic perfectly scoped for a 1-minute impromptu speech.",
  },
  {
    name: "Will Yapper add AI feedback or coaching in the future?",
    text: "It's on the roadmap. The free practice tool will always remain free. AI feedback and exam prep coaching are planned as optional future features.",
  },
];

const faqJsonLd = {
  "@type": "FAQPage",
  "@id": `${SITE}/#faq`,
  mainEntity: faqEntries.map((e) => ({
    "@type": "Question",
    name: e.name,
    acceptedAnswer: { "@type": "Answer", text: e.text },
  })),
};

const graph = [
  {
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "Yapper",
    description:
      "Free random topic generator for impromptu speaking practice, table topics, and speech prompts — in your browser.",
    publisher: { "@id": `${SITE}/#organization` },
    inLanguage: "en",
  },
  {
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: "Yapper",
    url: SITE,
  },
  {
    "@type": "WebApplication",
    "@id": `${SITE}/#webapp`,
    name: "Yapper",
    url: SITE,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Microphone and camera optional.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Free impromptu speaking practice with random speech topics, optional timer, and optional camera or mic recording.",
  },
  faqJsonLd,
];

export default function HomeJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
