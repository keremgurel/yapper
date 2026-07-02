import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TrainingLayout from "@/app/training-layout";
import { tools } from "@/data/tools";

const muted = { color: "var(--sg-text-muted)" };

/** The /tools landing: free creator tools that rank on their own and feed the
 * create loop. Visuals use the shared sg-* design system. */
export default function ToolsHub() {
  return (
    <TrainingLayout>
      <section className="px-4 pt-16 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="sg-chip">Free tools</span>
          <h1 className="sg-display mt-5 max-w-3xl text-5xl leading-[0.98] text-balance sm:text-6xl">
            Free tools for talking to camera
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8" style={muted}>
            Plan a script, read it off a teleprompter, and edit the take, all in
            your browser, no sign-up. Everything here flows into the full create
            loop when you&apos;re ready.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <article
              key={tool.slug}
              className="sg-card flex flex-col gap-4 p-6"
            >
              <span className="sg-chip self-start">{tool.category}</span>
              <div>
                <h2 className="sg-display text-2xl">{tool.title}</h2>
                <p className="sg-label mt-2">{tool.tagline}</p>
              </div>
              <p className="text-sm leading-6" style={muted}>
                {tool.description}
              </p>
              <Link
                href={tool.href}
                className="sg-btn-ghost mt-auto self-start no-underline"
              >
                {tool.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </TrainingLayout>
  );
}
