import type { ReactNode } from "react";

/** What stands in for a shelf's videos: connect, nothing yet, or a failure. */
export default function ShelfNotice({
  children,
  action,
  alert = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="bg-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3">
      <p
        role={alert ? "alert" : undefined}
        className="text-muted-foreground min-w-0 text-[13px]"
      >
        {children}
      </p>
      {action}
    </div>
  );
}
