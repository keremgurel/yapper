import Link from "next/link";
import { Lightbulb, Video, Scissors, Send, ArrowUpRight } from "lucide-react";
import { Section } from "@/components/studio-ui";
export default function QuickTools({
  ideaCount,
}: {
  ideaCount: number | null;
}) {
  const tools = [
    {
      title: "Ideas",
      href: "/studio/ideas",
      icon: Lightbulb,
      description:
        ideaCount === null
          ? "Capture and shape your next idea"
          : `${ideaCount} ${ideaCount === 1 ? "idea" : "ideas"} in progress`,
    },
    {
      title: "Recorder",
      href: "/studio/recorder",
      icon: Video,
      description: "Get your next take on camera",
    },
    {
      title: "Editor",
      href: "/studio/editor",
      icon: Scissors,
      description: "Turn a take into a finished video",
    },
    {
      title: "Poster",
      href: "/studio/poster",
      icon: Send,
      description: "Prepare and share across channels",
    },
  ];
  return (
    <Section title="Make your next video">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.title}
            href={tool.href}
            className="bg-card border-border hover:bg-muted focus-visible:outline-ring flex min-w-0 items-start gap-3 rounded-xl border p-4 no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <tool.icon
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{tool.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {tool.description}
              </p>
            </div>
            <ArrowUpRight
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          </Link>
        ))}
      </div>
    </Section>
  );
}
