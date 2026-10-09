import { CHIP_TONES, statusTone } from "@/components/studio-ui";
import type { ContentStatus } from "@/lib/db/schema";

const STAGES: { status: ContentStatus; label: string }[] = [
  { status: "captured", label: "Captured" },
  { status: "drafting", label: "Drafting" },
  { status: "ready", label: "Ready" },
  { status: "posted", label: "Posted" },
];

/** Every idea by where it is, as one proportional bar: the shape of the
 * pipeline at a glance, colored by the shared status hues. */
export default function PipelineBar({
  items,
}: {
  items: { status: ContentStatus }[];
}) {
  const counts = STAGES.map((stage) => ({
    ...stage,
    count: items.filter((item) => item.status === stage.status).length,
  }));
  const total = items.length;
  if (!total) return null;

  return (
    <div className="mb-3">
      <div
        aria-hidden
        className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        {counts
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <div
              key={stage.status}
              className={`${CHIP_TONES[statusTone(stage.status)].dot} h-full`}
              style={{ flexGrow: stage.count }}
            />
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {counts
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <li
              key={stage.status}
              className="text-muted-foreground flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className={`${CHIP_TONES[statusTone(stage.status)].dot} size-2 rounded-full`}
              />
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {stage.count}
              </span>
              {stage.label.toLowerCase()}
            </li>
          ))}
      </ul>
    </div>
  );
}
