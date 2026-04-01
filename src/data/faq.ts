export interface FaqEntry {
  question: string;
  shortAnswer: string;
  fullAnswer: string;
}

export const faqEntries: FaqEntry[] = [
  {
    question: "Is Yapper really free?",
    shortAnswer:
      "Yes, completely free. No account, no subscription, and no credit card.",
    fullAnswer:
      "Yes, completely free. No account, no subscription, and no credit card. We built this so anyone can practice speaking without friction. If it helps you, that is enough.",
  },
  {
    question: "Do you store my video or audio?",
    shortAnswer:
      "No. Nothing is uploaded or stored. Your mic and camera stay entirely in your browser.",
    fullAnswer:
      "No. Nothing you say or record is uploaded to our servers or stored in the cloud. Your mic and camera stay entirely in your browser, and we never see or keep your recordings.",
  },
  {
    question: "What happens to my recording after I practice?",
    shortAnswer:
      "Only you can download it right after finishing. If you skip, the recording is gone forever.",
    fullAnswer:
      "Only you can download it, and only after you finish if you want that file. If you skip download or close the tab, that recording is gone forever. No one else can replay it, and there is nothing to recover later. That is a feature, because nothing is at stake and you can go for it.",
  },
  {
    question: "What is impromptu speaking practice?",
    shortAnswer:
      "Speaking off the cuff with a random prompt and a timer that is useful for public speaking, interviews, ESL practice, and building confidence.",
    fullAnswer:
      "It is speaking off the cuff. You get a prompt, then you talk for a set time, such as 30 to 90 seconds, without a script. It is a widely used method for building public speaking confidence, performing in interviews, practicing ESL fluency, and thinking clearly under pressure. Yapper gives you random speech topics and a built-in timer so you can practice anytime, anywhere.",
  },
  {
    question: "Can I use this for Toastmasters table topics?",
    shortAnswer:
      "Yes. Table topics are short impromptu speeches, and Yapper provides random topics and a timer for solo practice.",
    fullAnswer:
      "Absolutely. Table topics are short impromptu speeches, and that is exactly what Yapper is built for. Pull the lever for a random topic, set your timer to 1 to 2 minutes, and practice just like a meeting role without needing a club room. Many Toastmasters members use random generators like this to prep between meetings.",
  },
  {
    question: "Do I need to sign up or create an account?",
    shortAnswer:
      "No. Open the page and start practicing without an account, email, or password.",
    fullAnswer:
      "No. Open the page, turn on camera or mic if you want, set your timer, and hit Start. That is it. No forms, no email, and no passwords.",
  },
  {
    question: "How does the random topic generator work?",
    shortAnswer:
      "Yapper has hundreds of curated speech topics across categories and difficulty levels. Pull the lever to pick one at random, or filter by category.",
    fullAnswer:
      "Yapper has hundreds of curated speech topics across categories like General, Technology, Business, Society, Fun, Debate, and Hot Takes, each with an Easy, Medium, or Hard difficulty level. Pull the lever and the slot machine picks one at random. You can filter by category or difficulty, or write your own prompt by double-tapping the topic card.",
  },
  {
    question: "Can I write my own speaking prompt?",
    shortAnswer:
      "Yes. Double-tap the topic card before a session to type your own prompt.",
    fullAnswer:
      "Yes. Before starting a session, double-tap the topic card to open the prompt editor. Type whatever you want to talk about, whether that is an interview question, a presentation topic, or anything else. Your custom prompt replaces the random one until you pull the lever again.",
  },
  {
    question: "What timer options are available?",
    shortAnswer:
      "Set the timer from 30 to 90 seconds using the rotary knob or by double-tapping the display to type a value.",
    fullAnswer:
      "You can set the timer anywhere from 30 to 90 seconds using the rotary knob, or double-tap the timer display to type an exact number. 60 seconds is the default, and it is a good sweet spot for impromptu speaking practice.",
  },
  {
    question: "Is this useful for practicing public speaking alone?",
    shortAnswer:
      "Yes. Yapper gives you a topic, a timer, and an optional camera so you can practice solo anywhere.",
    fullAnswer:
      "That is exactly the scenario we designed for. Most people do not have an audience on demand. Yapper gives you a topic, a timer, and optionally a camera so you can practice solo on your couch, at your desk, or anywhere else. It is one of the easiest ways to practice public speaking alone without needing another person.",
  },
  {
    question: "Can I use Yapper on my phone?",
    shortAnswer:
      "Yes. Yapper works in any modern mobile browser with camera and mic support. No app download needed.",
    fullAnswer:
      "Yes. Yapper works in any modern mobile browser, including Safari, Chrome, and Firefox. The camera and mic features work on mobile too. No app download is needed.",
  },
  {
    question: "Is this good for ESL or English speaking practice?",
    shortAnswer:
      "Yes. Random topics force you to think and express ideas in English on the spot, which is the exact skill IELTS, TOEFL, and CELPIP speaking tests measure.",
    fullAnswer:
      "Very much so. Yapper is used by English learners to practice fluency, reduce filler words, and build speaking confidence. The random topics force you to think and express ideas in English on the spot, which is exactly the skill IELTS, TOEFL, and CELPIP speaking sections test.",
  },
  {
    question: "How is Yapper different from other speech topic generators?",
    shortAnswer:
      "Yapper adds a built-in timer, optional camera and mic recording, difficulty levels, custom prompts, and a privacy-first design. It is a complete practice environment, not just a list.",
    fullAnswer:
      "Most random topic generators are just a list with a button. Yapper adds a built-in timer, optional camera and mic recording, difficulty levels, topic categories, custom prompts, and a privacy-first design where nothing leaves your browser. It is a complete practice environment, not just a list.",
  },
  {
    question: "Can I use Yapper for debate practice?",
    shortAnswer:
      "Yes. Dedicated Debate and Hot Takes categories provide topics designed for arguing a position.",
    fullAnswer:
      "Yes. We have a dedicated Debate category with topics designed to have two clear sides. Hot Takes is another great option for debate-style practice because the prompts are intentionally provocative and push you to argue a position.",
  },
  {
    question: "What are good 1-minute speech topics?",
    shortAnswer:
      "Yapper generates hundreds. Set the timer to 60 seconds, pull the lever, and get a topic that is well scoped for a 1-minute impromptu speech.",
    fullAnswer:
      "Yapper generates hundreds of them across many categories. Set the timer to 60 seconds, pull the lever, and you will get a topic that is well scoped for a 1-minute impromptu speech, from lighthearted questions like 'What is the most overrated food?' to thought-provoking prompts like 'Should voting be mandatory?'",
  },
  {
    question: "Will Yapper add AI feedback or coaching in the future?",
    shortAnswer:
      "It's on the roadmap. The free practice tool will always remain free. AI feedback and exam prep coaching are planned as optional future features.",
    fullAnswer:
      "We are exploring it. The free practice tool will always remain free. Future features like AI-powered speaking feedback, structured coaching for CELPIP or TOEFL prep, and progress tracking are on the roadmap, but the core random topic generator with timer and recording will stay free.",
  },
];

export function getJsonLdFaqEntries() {
  return faqEntries.map((e) => ({
    name: e.question,
    text: e.shortAnswer,
  }));
}

export function getFaqSection1() {
  return faqEntries.slice(0, 8).map((e) => ({
    q: e.question,
    a: e.fullAnswer,
  }));
}

export function getFaqSection2() {
  return faqEntries.slice(8).map((e) => ({
    q: e.question,
    a: e.fullAnswer,
  }));
}
