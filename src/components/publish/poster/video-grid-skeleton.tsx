/** The grid's shape while the library loads, so nothing jumps when it lands. */
export default function VideoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
      aria-busy="true"
      aria-label="Loading finished videos"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="bg-muted aspect-[9/16] animate-pulse rounded-xl motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
