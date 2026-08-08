import type { LucideIcon } from "lucide-react";

/**
 * The one empty-surface pattern. Names the next action rather than the
 * absence, and never draws a dashed border: it sits directly on whatever
 * surface it belongs to.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="bg-muted text-muted-foreground mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      )}
      <p className="text-foreground text-sm font-semibold">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-[36ch] text-[13px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
