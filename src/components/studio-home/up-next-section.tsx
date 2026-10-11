import Link from "next/link";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Section, statusTone } from "@/components/studio-ui";
import type { ItemSummary } from "@/lib/ideas/client";
import { itemTitle } from "@/components/studio-home/item-title";
import { upNextItems } from "@/components/studio-home/up-next";
import PipelineBar from "@/components/studio-home/pipeline-bar";
import { STATUS_LABEL } from "@/lib/content/status-label";

function scheduledLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** The answer to "what do I work on now": the pipeline at a glance, then the
 * next five ideas, dated work first. A fresh capture lands at the top and
 * says so while Yapper is still shaping it. Render-only. */
export default function UpNextSection({
  items,
  shaping,
  failed,
  onRetry,
}: {
  /** Null while the first load is in flight. */
  items: ItemSummary[] | null;
  /** Ideas Yapper is still turning into a script. */
  shaping: Set<string>;
  failed: boolean;
  onRetry: () => void;
}) {
  const queue = items === null ? null : upNextItems(items);

  return (
    <Section
      title="Up next"
      action={
        items?.length ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/ideas">All ideas</Link>
          </Button>
        ) : null
      }
    >
      {failed ? (
        <div className="flex flex-wrap items-center gap-3 py-2 text-sm">
          <p className="text-muted-foreground">Your ideas didn’t load.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : queue === null ? (
        <div aria-hidden className="space-y-2 py-1">
          <div className="bg-muted mb-4 h-2 animate-pulse rounded-full" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="bg-muted h-9 animate-pulse rounded-md" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={items?.length ? "Everything’s posted" : "No ideas yet"}
          description={
            items?.length
              ? "Capture the next one above and it lands here."
              : "Capture one above. It shows up here with a script started."
          }
        />
      ) : (
        <>
          <PipelineBar items={items ?? []} />
          <ul className="divide-border/60 divide-y">
            {queue.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/studio/library/${item.id}`}
                  className="hover:bg-muted/60 -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 no-underline transition-colors"
                >
                  <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                    {itemTitle(item)}
                  </span>
                  {shaping.has(item.id) ? (
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                      <Loader2 aria-hidden className="size-3 animate-spin" />
                      <span className="sr-only sm:not-sr-only">
                        Writing a script…
                      </span>
                    </span>
                  ) : item.status === "ready" && item.scheduledFor ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                      {scheduledLabel(item.scheduledFor)}
                    </span>
                  ) : null}
                  <Chip tone={statusTone(item.status)} pill>
                    {STATUS_LABEL[item.status]}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
