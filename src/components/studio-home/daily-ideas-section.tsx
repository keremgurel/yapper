import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";

/** Five prompts to start from today. Every row lands in the Idea Bank, where
 * the prompt gets captured and shaped. */
export default function DailyIdeasSection({ ideas }: { ideas: string[] }) {
  const today = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <Section
      title="Five for today"
      meta={today}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/studio/ideas">Open Idea Bank</Link>
        </Button>
      }
    >
      <ol className="divide-border/60 divide-y">
        {ideas.map((title, index) => (
          <li key={title}>
            <Link
              href="/studio/ideas"
              className="hover:bg-muted/60 group -mx-2 flex min-h-10 items-center gap-3 rounded-md px-2 py-1.5 no-underline transition-colors"
            >
              <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-[11px] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-foreground line-clamp-2 min-w-0 flex-1 text-[13px] leading-5 font-medium">
                {title}
              </span>
              <ArrowRight
                aria-hidden
                className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  );
}
