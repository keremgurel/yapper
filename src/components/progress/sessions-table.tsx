import Link from "next/link";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio-ui";
import SessionRow from "@/components/progress/session-row";
import SessionsTableSkeleton from "@/components/progress/sessions-table-skeleton";
import type { ProgressSession } from "@/lib/progress/types";

/**
 * The dense recent-sessions table: 40px rows, sunken header, each row linking
 * to that session's full feedback. Wide content scrolls inside the card.
 */
export default function SessionsTable({
  sessions,
}: {
  sessions: ProgressSession[] | null;
}) {
  if (sessions === null) return <SessionsTableSkeleton />;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Mic}
        title="No sessions yet"
        description="Run a drill and get coached; every rep lands here."
        action={
          <Button asChild>
            <Link href="/training">Start a drill</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="bg-card border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
              Date
            </th>
            <th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
              Drill
            </th>
            <th className="text-muted-foreground hidden w-full px-4 py-2 text-left text-xs font-semibold md:table-cell">
              Prompt
            </th>
            <th className="text-muted-foreground px-4 py-2 text-right text-xs font-semibold">
              Length
            </th>
            <th className="text-muted-foreground px-4 py-2 text-right text-xs font-semibold">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-border/60 divide-y">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
