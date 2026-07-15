import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HEADER_GRID,
  ROW_GRID,
} from "@/components/library/content-table-layout";

/** Loading placeholder for the library table: the real header over a few greyed
 * rows shaped like the content that is coming. Preferred over a spinner so the
 * layout does not jump when the rows arrive. */
export default function ContentTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="gap-0 overflow-hidden py-0" aria-hidden>
      <div
        className={`${HEADER_GRID} bg-muted/40 text-muted-foreground border-b px-4 py-3 text-[11px] font-bold tracking-wider uppercase`}
      >
        <span className="font-display">Title</span>
        <span className="font-display">Status</span>
        <span className="font-display">Updated</span>
        <span />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`${ROW_GRID} border-b px-4 py-3.5 last:border-b-0`}
        >
          <Skeleton className="h-4 w-2/3 max-w-[16rem]" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <span />
        </div>
      ))}
    </Card>
  );
}
