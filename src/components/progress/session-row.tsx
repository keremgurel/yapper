"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/studio-ui";
import {
  formatDuration,
  formatSessionDay,
  formatSessionTime,
} from "@/components/progress/format";
import type { ProgressSession } from "@/lib/progress/types";

function ScoreCell({ session }: { session: ProgressSession }) {
  if (session.scores) {
    return (
      <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
        {session.scores.overall}
      </span>
    );
  }
  // Status chips: tint + pill, hues per the fixed vocabulary. Failed is a
  // degraded state (yellow), an unscored rep in flight is in progress (cyan),
  // and a saved rep that was never coached stays neutral text.
  if (session.status === "failed") {
    return (
      <Chip tone="yellow" pill>
        Failed
      </Chip>
    );
  }
  if (session.status === "pending" || session.status === "processing") {
    return (
      <Chip tone="cyan" pill>
        Processing
      </Chip>
    );
  }
  return <span className="text-muted-foreground text-[13px]">Not coached</span>;
}

/**
 * One 40px row of the recent-sessions table. The date is the real link to
 * the session's feedback (keyboard and screen-reader path); clicking anywhere
 * on the row goes to the same place as a convenience.
 */
export default function SessionRow({ session }: { session: ProgressSession }) {
  const router = useRouter();
  const href = `/progress/${session.id}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="hover:bg-muted/50 focus-within:bg-muted/50 cursor-pointer transition-colors duration-[var(--sg-dur-fast)] motion-reduce:transition-none"
    >
      <td className="min-h-10 px-4 py-2">
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="text-foreground focus-visible:ring-ring rounded-sm text-sm font-medium whitespace-nowrap no-underline focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Session on ${formatSessionDay(session.createdAt)} at ${formatSessionTime(session.createdAt)}, open feedback`}
        >
          {formatSessionDay(session.createdAt)}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {formatSessionTime(session.createdAt)}
          </span>
        </Link>
      </td>
      <td className="px-4 py-2 text-[13px] whitespace-nowrap">
        {session.context?.drillTitle ?? (
          <span className="text-muted-foreground">Free practice</span>
        )}
      </td>
      <td className="hidden max-w-0 px-4 py-2 md:table-cell">
        <span className="text-muted-foreground block truncate text-[13px]">
          {session.context?.prompt || "-"}
        </span>
      </td>
      <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums">
        {formatDuration(session.durationSec) ?? "-"}
      </td>
      <td className="px-4 py-2 text-right">
        <ScoreCell session={session} />
      </td>
    </tr>
  );
}
