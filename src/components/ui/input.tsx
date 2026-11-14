import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "selection:text-foreground file:text-foreground bg-card h-10 w-full min-w-0 rounded-xl px-3.5 py-1 text-base shadow-[var(--sg-shadow-raised)] transition-[color,box-shadow] outline-none selection:bg-[color-mix(in_oklab,var(--sg-accent)_28%,transparent)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--sg-text-faint)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:shadow-[var(--sg-shadow-raised),0_0_0_3px_color-mix(in_srgb,var(--sg-text)_14%,transparent)]",
        "aria-invalid:shadow-[0_0_0_1px_var(--destructive)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
