import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Section, statusTone } from "@/components/studio-ui";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";
import { itemTitle } from "@/components/studio-home/item-title";
import { upNextItems } from "@/components/studio-home/up-next";

const STATUS_LABEL: Record<ContentStatus, string> = {
  drafted: "Drafted",
  planned: "Planned",
  scheduled: "Scheduled",
  posted: "Posted",
};

function scheduledLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** The answer to "what should I work on now": unposted library items, dated
 * work first. Render-only; the parent owns loading. */
export default function UpNextSection({
  items,
}: {
  items: ContentSummary[] | null;
}) {
  const queue = items === null ? null : upNextItems(items);

  return (
    <Section
      title="Up next"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/studio/library">Open Library</Link>
        </Button>
      }
    >
      {queue === null ? (
        <div aria-hidden className="space-y-2 py-1">
          {[0, 1, 2].map((row) => (
            <div key={row} className="bg-muted h-9 animate-pulse rounded-md" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Nothing queued to shoot"
          description="Send an idea to the Library and it will show up here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/ideas">Open Idea Bank</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-border/60 divide-y">
          {queue.map((item) => (
            <li key={item.id}>
              <Link
                href={`/studio/library/${item.id}`}
                className="hover:bg-muted/60 -mx-2 flex min-h-10 items-center gap-3 rounded-md px-2 no-underline transition-colors"
              >
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                  {itemTitle(item)}
                </span>
                {item.status === "scheduled" && item.scheduledFor && (
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {scheduledLabel(item.scheduledFor)}
                  </span>
                )}
                <Chip tone={statusTone(item.status)} pill>
                  {STATUS_LABEL[item.status]}
                </Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
