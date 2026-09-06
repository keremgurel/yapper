import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { columnDef, gridTemplate, type ColumnKey } from "@/lib/content/columns";

/**
 * Loading placeholder for the shared item table: the real header over a few
 * greyed rows shaped like the content that is coming. Preferred over a spinner
 * so the layout does not jump when the rows arrive.
 *
 * Takes the same column set as the table, so the two can never disagree about
 * how many columns there are or how wide they sit.
 */
export default function ItemTableSkeleton({
  columns,
  rows = 5,
}: {
  columns: ColumnKey[];
  rows?: number;
}) {
  const grid = gridTemplate(columns, false);

  return (
    <Card className="gap-0 overflow-hidden py-0" aria-hidden>
      <div
        className="bg-muted text-muted-foreground grid min-h-9 items-center gap-3 border-b px-4 py-1.5 text-xs font-semibold"
        style={{ gridTemplateColumns: grid }}
      >
        <span />
        {columns.map((key) => (
          <span key={key} className="truncate">
            {columnDef(key).label}
          </span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid min-h-10 items-center gap-3 border-b px-4 py-1 last:border-b-0"
          style={{ gridTemplateColumns: grid }}
        >
          <Skeleton className="h-[18px] w-[18px] rounded-[5px]" />
          {columns.map((key) => (
            <Skeleton
              key={key}
              className={
                key === "title" ? "h-4 w-2/3 max-w-[16rem]" : "h-4 w-16"
              }
            />
          ))}
        </div>
      ))}
    </Card>
  );
}
