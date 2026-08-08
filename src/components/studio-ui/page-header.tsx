/**
 * The one page-title treatment for Studio surfaces. Working size, no eyebrow,
 * no marketing headline: a tool the creator opens daily does not re-introduce
 * itself. Actions sit on the baseline so the header stays one visual row.
 */
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-foreground text-[22px] font-bold tracking-[-0.01em]">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
