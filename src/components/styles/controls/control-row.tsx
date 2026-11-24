import type { ReactNode } from "react";

/** One setting: its name, its current value when that is worth reading, and the control. */
export default function ControlRow({
  label,
  value,
  help,
  children,
}: {
  label: string;
  value?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-foreground text-[13px] font-medium">{label}</span>
        {value !== undefined && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {value}
          </span>
        )}
      </div>
      {children}
      {help && (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {help}
        </p>
      )}
    </div>
  );
}
