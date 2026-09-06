import { StatBlock } from "@/components/studio-ui";
import { compactNumber } from "@/components/studio-home/format-number";

/** The four channel numbers, once, in one Level-1 card. Cells are separated
 * by hairlines rather than one bordered box per stat; while channel history
 * loads the StatBlocks keep their shape as skeletons. */
export default function PerformanceBand({
  loaded,
  totalViews,
  postCount,
  averageViews,
  connectedCount,
  unavailable = false,
}: {
  loaded: boolean;
  totalViews: number;
  postCount: number;
  averageViews: number;
  connectedCount: number;
  unavailable?: boolean;
}) {
  const stats = [
    {
      label: "Total views",
      value: compactNumber(totalViews),
      detail: "All loaded channel history",
    },
    {
      label: "Posts",
      value: compactNumber(postCount),
      detail: "Across every channel",
    },
    {
      label: "Average views",
      value: compactNumber(averageViews),
      detail: "Per published post",
    },
    {
      label: "Channels",
      value: `${connectedCount}/3`,
      detail: "Connected for publishing",
    },
  ];

  return (
    <section
      aria-label="Channel performance"
      className="bg-card border-border overflow-hidden rounded-xl border"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-border/60 odd:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0"
          >
            <StatBlock
              label={stat.label}
              value={loaded ? (unavailable ? "n/a" : stat.value) : null}
              detail={
                unavailable ? "Some data couldn’t be loaded" : stat.detail
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
