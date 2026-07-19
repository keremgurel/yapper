import Link from "next/link";
import TrainingHeader from "@/components/training/training-header";

/** Shared shell for the Terms and Privacy pages: site header, a readable
 * single-column container, title, last-updated line, and a contact footer. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TrainingHeader />
      <div className="pt-12 pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <Link
            href="/"
            className="text-foreground/40 hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Yapper
          </Link>

          <h1 className="text-foreground mt-8 text-4xl font-black tracking-tight">
            {title}
          </h1>
          <p className="text-foreground/50 mt-3 text-sm">
            Last updated {updated}
          </p>
          <p className="text-foreground/70 mt-6 text-[15px] leading-relaxed">
            {intro}
          </p>

          <div className="mt-10 space-y-9">{children}</div>

          <div className="border-border text-foreground/55 mt-16 space-y-1 border-t pt-8 text-sm">
            <p>OCX Software Inc.</p>
            <p>
              Questions about these terms or your data? Email{" "}
              <a
                className="text-foreground underline underline-offset-2"
                href="mailto:support@ypr.app"
              >
                support@ypr.app
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** One titled section of a legal document. Body text is passed as children so
 * paragraphs and lists render with consistent spacing. */
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-xl font-bold tracking-tight">
        {heading}
      </h2>
      <div className="text-foreground/70 [&_a]:text-foreground space-y-3 text-[15px] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
