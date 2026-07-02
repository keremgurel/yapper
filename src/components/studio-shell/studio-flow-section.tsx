import Link from "next/link";
import { ArrowRight } from "lucide-react";

import StudioNavIcon from "@/components/studio-shell/studio-nav-icon";
import { studioNav } from "@/data/studio-nav";

/** Homepage section marketing the Studio workflow (the main app). */
export default function StudioFlowSection() {
  return (
    <section className="bg-background w-full px-4 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1100px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
            The Studio workflow
          </p>
          <h2 className="font-display text-foreground mt-3 text-[32px] leading-[1.1] font-black tracking-tight md:text-[44px]">
            From a saved clip to a posted video.
          </h2>
          <p className="text-foreground/60 mx-auto mt-4 max-w-xl text-[15px] leading-relaxed">
            Collect inspiration, shape ideas into scripts with AI, track them
            through your content pipeline, record with a teleprompter, and edit
            by editing the transcript.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {studioNav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border-border bg-card hover:border-foreground/20 flex flex-col rounded-2xl border p-5 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="border-border bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-xl border">
                  <StudioNavIcon icon={item.icon} className="h-4 w-4" />
                </span>
                <span className="text-foreground/35 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="text-foreground mt-4 text-lg font-black tracking-tight">
                {item.title}
              </p>
              <p className="text-foreground/55 mt-1 text-[13px] leading-5">
                {item.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/studio/library"
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black no-underline transition-opacity hover:opacity-90"
          >
            Open your Studio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
