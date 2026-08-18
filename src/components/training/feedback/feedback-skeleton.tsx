/**
 * Loading placeholder that keeps the result screen's shape: hero card,
 * five meter rows, the delivery strip, and the transcript card.
 */
export default function FeedbackSkeleton() {
  return (
    <div role="status" aria-label="Scoring your rep" className="space-y-8">
      <span className="sr-only">Scoring your rep</span>
      <div aria-hidden className="space-y-8">
        <div className="bg-card border-border rounded-xl border p-5">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="bg-muted h-[132px] w-[132px] shrink-0 animate-pulse rounded-full motion-reduce:animate-none" />
            <div className="w-full flex-1 space-y-3 pt-2">
              <div className="bg-muted h-5 w-20 animate-pulse rounded-full motion-reduce:animate-none" />
              <div className="bg-muted h-4 w-full max-w-[52ch] animate-pulse rounded motion-reduce:animate-none" />
              <div className="bg-muted h-4 w-full max-w-[44ch] animate-pulse rounded motion-reduce:animate-none" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="bg-muted h-4 w-40 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-muted h-4 w-8 animate-pulse rounded motion-reduce:animate-none" />
              </div>
              <div className="bg-muted h-1.5 w-full animate-pulse rounded-full motion-reduce:animate-none" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted h-7 w-24 animate-pulse rounded-md motion-reduce:animate-none"
            />
          ))}
        </div>
        <div className="bg-card border-border space-y-3 rounded-xl border p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted h-4 w-full max-w-[60ch] animate-pulse rounded motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
