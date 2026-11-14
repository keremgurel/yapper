/**
 * The mark a destination earns when its post lands. The disc settles in and
 * the tick draws once on mount (`.posted-check` in globals.css); with reduced
 * motion the finished mark is simply there.
 */
export default function PostedCheck({
  className = "size-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`posted-check shrink-0 ${className}`}
    >
      <circle cx="10" cy="10" r="10" fill="var(--sg-green-500)" />
      <path
        d="M5.75 10.5l2.75 2.75 5.75-6.25"
        pathLength={1}
        fill="none"
        stroke="var(--sg-bg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
