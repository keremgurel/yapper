/** A shelf's shape while its videos load, so nothing jumps when they land. */
export default function ShelfSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex gap-3 overflow-hidden pb-2"
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="w-[112px] shrink-0 sm:w-[128px]">
          <div className="bg-muted aspect-[9/16] animate-pulse rounded-2xl motion-reduce:animate-none" />
          <div className="bg-muted mt-2 h-3 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
          <div className="bg-muted mt-1.5 h-3 w-1/2 animate-pulse rounded motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
