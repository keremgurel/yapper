import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { SITE_URL, safeJsonLdStringify } from "@/lib/json-ld";
import { TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";

const PATH = "/about";
const UPDATED = "2026-11-25";

export const metadata = marketingMetadata(
  "About Yapper: the content creation studio at ypr.app",
  "What Yapper is, who makes it and where it runs. Yapper Studio takes a video from idea to script, teleprompter recording, editing, captions and cross-posting.",
  PATH,
  { brandSuffix: false },
);

const facts: { term: string; detail: string }[] = [
  {
    term: "What it is",
    detail:
      "Yapper Studio, an all-in-one content creation studio for people who make talking-to-camera videos.",
  },
  {
    term: "Made by",
    detail: "OCX Software Inc. Founder: Can Gurel.",
  },
  {
    term: "Website",
    detail: "ypr.app",
  },
  {
    term: "Where it runs",
    detail:
      "On the web for ideas, scripts and publishing, and in the desktop Studio app on Mac for recording and editing. Mobile is coming soon. Windows is not available yet.",
  },
  {
    term: "Price",
    detail: `$24.99 a month or $199.99 a year, with credits for AI. A ${TRIAL_DAYS}-day free trial includes ${TRIAL_CREDITS} credits.`,
  },
  {
    term: "Publishes to",
    detail: "Connected YouTube, TikTok and Instagram accounts.",
  },
];

const steps: { title: string; href: string; text: string }[] = [
  {
    title: "Capture ideas",
    href: "/features/idea-capture",
    text: "Talk, type or paste a link. Brain keeps your voice notes, references and earlier videos together so new ideas sound like you.",
  },
  {
    title: "Write the script",
    href: "/features/ai-script-writer",
    text: "Turn an idea into hooks, an outline and a script for Reels, Shorts or TikTok, then edit every line in your own words.",
  },
  {
    title: "Record with a teleprompter",
    href: "/features/teleprompter-recorder",
    text: "Record a talking-head take with your script in view, at your pace, and keep it with the project.",
  },
  {
    title: "Edit by transcript",
    href: "/features/transcript-video-editor",
    text: "One-click edit removes silences, mistakes and retakes; then refine the cut by selecting words in the transcript.",
  },
  {
    title: "Add captions",
    href: "/features/automatic-captions",
    text: "Generate timed captions from the transcript and style them for the frame.",
  },
  {
    title: "Cross-post and schedule",
    href: "/features/social-publishing",
    text: "Set a caption and thumbnail for each channel, then publish now or schedule it.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "What is Yapper?",
    a: "Yapper (ypr.app) is a content creation studio made by OCX Software Inc. Yapper Studio covers a talking-to-camera video from the first idea to the published post: idea capture, AI script writing, a teleprompter recorder, transcript-based video editing, automatic captions, a content calendar and cross-posting.",
  },
  {
    q: "Who makes Yapper?",
    a: "Yapper is a product of OCX Software Inc. It was founded by Can Gurel, who also writes the guides on the Yapper blog.",
  },
  {
    q: "Is Yapper only for Mac?",
    a: "No. You plan ideas, write scripts and schedule or publish posts on the web. Recording and editing happen in the desktop Studio app, which is on Mac today. A mobile app is coming soon. Windows is not available yet.",
  },
  {
    q: "Does Yapper generate videos from a text prompt?",
    a: "Yapper is built for videos where you are the one on camera. It uses AI to help you find ideas, write and tighten the script, transcribe, edit and caption your recording. You still record the video yourself with the teleprompter.",
  },
  {
    q: "How much does Yapper cost?",
    a: `One Studio membership includes every tool: $24.99 a month or $199.99 a year, with AI credits included. New members can try it free for ${TRIAL_DAYS} days with ${TRIAL_CREDITS} credits. See the pricing page for current details.`,
  },
  {
    q: "How do Yapper credits work?",
    a: "Writing, recording and editing by hand do not use credits. Credits are spent when you ask the AI to do something, such as transcribing a recording or drafting a script. Each paid plan includes credits, and you can buy more packs.",
  },
  {
    q: "Is Yapper safe to use?",
    a: "Your account is handled by Clerk and payments by Stripe; Yapper does not store your full card number. You keep ownership of everything you create, and Yapper does not use your recordings or connected-platform data to train its own general-purpose models. The privacy policy lists every service provider.",
  },
  {
    q: "Is ypr.app related to other apps called Yapper?",
    a: "Yapper at ypr.app is made by OCX Software Inc. It is not affiliated with other apps, websites or tokens that use the name Yapper.",
  },
  {
    q: "What happened to Yapper's speaking practice tool?",
    a: "The speaking practice tool that used to live on ypr.app moved to its own product, Speaking Practice at speakingpractice.ai, in October 2026. Yapper now focuses on creating and publishing video.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}${PATH}#page`,
      url: `${SITE_URL}${PATH}`,
      name: "About Yapper",
      dateModified: UPDATED,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      mainEntity: { "@id": `${SITE_URL}/#software` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Yapper",
      legalName: "OCX Software Inc.",
      url: SITE_URL,
      founder: { "@type": "Person", name: "Can Gurel" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Yapper Studio",
      url: SITE_URL,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web, macOS",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: [
        {
          "@type": "Offer",
          price: "24.99",
          priceCurrency: "USD",
          name: "Studio monthly",
        },
        {
          "@type": "Offer",
          price: "199.99",
          priceCurrency: "USD",
          name: "Studio yearly",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}${PATH}#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function AboutPage() {
  return (
    <MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Studio", href: "/" },
              { label: "About", href: PATH },
            ]}
          />
          <h1 className="type-h1 max-w-2xl">About Yapper</h1>
          <p className="marketing-lede">
            Yapper is a content creation studio for talking-to-camera video.
            Yapper Studio takes one video from a half-formed idea to a script, a
            teleprompter recording, a transcript edit, captions and a scheduled
            post, without moving files between apps. It is made by OCX Software
            Inc. and runs on the web and on desktop, with mobile coming soon.
          </p>
          <p className="marketing-note">
            Updated November 25, 2026.{" "}
            <Link href="/pricing" className="underline underline-offset-4">
              See plans
            </Link>
            .
          </p>
        </div>
      </section>

      <section
        className="marketing-section marketing-rule"
        aria-labelledby="about-facts"
      >
        <div className="marketing-container max-w-3xl">
          <h2 id="about-facts" className="type-h2">
            Yapper at a glance
          </h2>
          <dl className="mt-6 flex flex-col gap-4">
            {facts.map((f) => (
              <div key={f.term} className="flex flex-col gap-1">
                <dt className="font-semibold">{f.term}</dt>
                <dd className="text-foreground/70">{f.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        className="marketing-section marketing-rule"
        aria-labelledby="about-workflow"
      >
        <div className="marketing-container max-w-3xl">
          <h2 id="about-workflow" className="type-h2">
            What Yapper Studio does
          </h2>
          <ol className="mt-6 flex list-decimal flex-col gap-4 pl-5">
            {steps.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="font-semibold underline underline-offset-4"
                >
                  {s.title}
                </Link>
                <p className="text-foreground/70 mt-1">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-foreground/70 mt-6">
            The guides on the{" "}
            <Link href="/blog" className="underline underline-offset-4">
              Yapper blog
            </Link>{" "}
            cover the craft behind each step, from{" "}
            <Link
              href="/blog/how-to-write-a-video-script"
              className="underline underline-offset-4"
            >
              writing a video script
            </Link>{" "}
            to{" "}
            <Link
              href="/blog/talking-head-video"
              className="underline underline-offset-4"
            >
              recording a talking head video
            </Link>
            .
          </p>
        </div>
      </section>

      <section
        className="marketing-section marketing-rule"
        aria-labelledby="about-faq"
      >
        <div className="marketing-container max-w-3xl">
          <h2 id="about-faq" className="type-h2">
            Questions about Yapper
          </h2>
          <div className="mt-6 flex flex-col gap-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-lg font-semibold">{f.q}</h3>
                <p className="text-foreground/70 mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
