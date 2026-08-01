import type { Metadata } from "next";
import { ArrowRight, Check, Mic } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Yapper Design System",
  robots: { index: false, follow: false },
};

const sections = [
  ["principles", "Principles"],
  ["typography", "Typography"],
  ["content", "Content"],
  ["buttons", "Buttons"],
  ["layout", "Layout"],
  ["color", "Color"],
] as const;

const rules = [
  "Use Hanken Grotesk for every interface and marketing surface.",
  "Use the shared type classes. Do not invent a font size inside a page.",
  "Use the shared Button component for every CTA and standard action.",
  "Use one 1200px marketing container and one 1440px Studio container.",
  "Write labels in sentence case. Reserve uppercase for real acronyms.",
  "Reserve monospace for code, timecodes, and technical data only.",
  "Every section must work in light and dark mode.",
];

export default function StyleGuidePage() {
  return (
    <TrainingLayout>
      <div className="marketing-container pt-16 pb-32 sm:pt-24">
        <header className="max-w-4xl">
          <p className="type-label text-[var(--sg-accent-strong)]">
            Canonical design system
          </p>
          <h1 className="type-h1 mt-4">One Yapper, everywhere.</h1>
          <p className="type-description mt-6 max-w-2xl sm:text-lg">
            This is the source of truth for the website, desktop app, and mobile
            app. New surfaces must reuse these foundations before introducing a
            new pattern.
          </p>
        </header>

        <nav
          aria-label="Design system sections"
          className="border-border bg-background/90 sticky top-16 z-30 mt-12 overflow-x-auto rounded-xl border p-2 backdrop-blur-xl"
        >
          <div className="flex min-w-max gap-1">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-sm font-semibold no-underline"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-20 space-y-28">
          <GuideSection
            id="principles"
            label="Foundations"
            title="Rules that do not drift"
            description="These rules apply to marketing, Studio, tools, and mobile. Exceptions require a documented product reason."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="border-border bg-card flex gap-3 rounded-xl border p-4"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sg-accent)]" />
                  <p className="text-foreground text-sm leading-6 font-medium">
                    {rule}
                  </p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection
            id="typography"
            label="Typography"
            title="One family, one hierarchy"
            description="Hanken Grotesk carries display and body copy. Weight, size, and spacing create hierarchy without introducing novelty fonts."
          >
            <div className="border-border divide-border divide-y rounded-2xl border">
              <TypeRow name="Display / H1" use="Homepage and route title">
                <p className="type-h1">Turn ideas into videos.</p>
              </TypeRow>
              <TypeRow name="H2" use="Major page section">
                <p className="type-h2">One connected process.</p>
              </TypeRow>
              <TypeRow name="H3" use="Feature or card title">
                <p className="type-h3">Edit video by transcript.</p>
              </TypeRow>
              <TypeRow name="Description" use="Supporting explanation">
                <p className="type-description max-w-xl">
                  Say what the product does, who it is for, and why the feature
                  matters in plain language.
                </p>
              </TypeRow>
              <TypeRow name="Label" use="Quiet orientation, never decoration">
                <p className="type-label">The complete workflow</p>
              </TypeRow>
            </div>
          </GuideSection>

          <GuideSection
            id="content"
            label="Content"
            title="Clear before clever"
            description="Every section should answer a product question. Search terms belong where they describe the real job, not where they merely fit."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <ContentCard
                title="Heading"
                text="State the outcome or job. One thought, usually under ten words."
              />
              <ContentCard
                title="Description"
                text="Name the user, action, and result. Use one or two sentences."
              />
              <ContentCard
                title="CTA"
                text="Use a specific verb and destination. Keep the same label for the same action."
              />
            </div>
            <div className="border-border bg-muted mt-6 rounded-2xl border p-6">
              <p className="text-foreground font-semibold">Vocabulary</p>
              <p className="type-description mt-2 text-sm">
                Prefer “content creation app,” “video script generator,”
                “teleprompter,” “transcript video editor,” “video captions,”
                “content calendar,” and “social media scheduler” when they
                accurately name the feature. Avoid decorative product jargon.
              </p>
            </div>
          </GuideSection>

          <GuideSection
            id="buttons"
            label="Components"
            title="One button family"
            description="Every standard action uses components/ui/button.tsx. Size reflects importance, not the page it appears on."
          >
            <div className="space-y-8">
              <Specimen label="Variants">
                <Button>Join the waitlist</Button>
                <Button variant="contrast">Download Yapper</Button>
                <Button variant="outline">See all features</Button>
                <Button variant="ghost">Not now</Button>
                <Button variant="link">Read the guide</Button>
              </Specimen>
              <Specimen label="Sizes">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
              </Specimen>
              <Specimen label="Content and state">
                <Button>
                  <Mic /> Start recording
                </Button>
                <Button variant="outline">
                  Continue <ArrowRight />
                </Button>
                <Button disabled>Processing</Button>
              </Specimen>
            </div>
          </GuideSection>

          <GuideSection
            id="layout"
            label="Layout"
            title="No random width changes"
            description="Shared containers prevent the page from jumping as people move between routes."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ContentCard
                title="Marketing: 1200px"
                text="Use .marketing-container on the homepage, feature pages, tools, blog, and legal pages."
              />
              <ContentCard
                title="Studio: 1440px"
                text="Use StudioContentFrame and --studio-content-max-width throughout the application."
              />
            </div>
            <div className="border-border mt-6 flex flex-wrap gap-6 rounded-2xl border p-6">
              {[4, 8, 12, 16, 24, 32, 48, 64, 96].map((space) => (
                <div key={space} className="text-center">
                  <div
                    className="mx-auto rounded-sm bg-[var(--sg-accent)]"
                    style={{ width: Math.max(4, space / 2), height: space }}
                  />
                  <p className="text-muted-foreground mt-2 text-xs">{space}</p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection
            id="color"
            label="Theme"
            title="The same system in both modes"
            description="Use semantic tokens so every section follows the active theme. Feature artwork may stay cinematic, but its surrounding page must adapt."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Swatch name="Background" color="var(--sg-bg)" />
              <Swatch name="Surface" color="var(--sg-surface)" />
              <Swatch name="Text" color="var(--sg-text)" />
              <Swatch name="Orange" color="var(--sg-accent)" />
            </div>
          </GuideSection>
        </div>
      </div>
    </TrainingLayout>
  );
}

function GuideSection({
  id,
  label,
  title,
  description,
  children,
}: {
  id: string;
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36">
      <div className="mb-8 max-w-3xl">
        <p className="type-label text-[var(--sg-accent-strong)]">{label}</p>
        <h2 className="type-h2 mt-3">{title}</h2>
        <p className="type-description mt-4">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TypeRow({
  name,
  use,
  children,
}: {
  name: string;
  use: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-foreground font-semibold">{name}</span>
        <span className="text-muted-foreground">{use}</span>
      </div>
      {children}
    </div>
  );
}

function ContentCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <h3 className="text-foreground text-lg font-bold">{title}</h3>
      <p className="type-description mt-2 text-sm">{text}</p>
    </div>
  );
}

function Specimen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="type-label mb-3">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-3">
      <div
        className="border-border aspect-[4/3] rounded-xl border"
        style={{ background: color }}
      />
      <p className="text-foreground mt-3 text-sm font-semibold">{name}</p>
    </div>
  );
}
