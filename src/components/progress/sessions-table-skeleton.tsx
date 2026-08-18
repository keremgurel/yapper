/** Keeps the table's card shape while the payload loads. */
export default function SessionsTableSkeleton() {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            aria-hidden
            className="bg-muted h-7 animate-pulse rounded-md motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
