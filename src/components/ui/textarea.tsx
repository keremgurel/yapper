import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-card flex field-sizing-content min-h-16 w-full rounded-xl px-3.5 py-2.5 text-base shadow-[var(--sg-shadow-raised)] transition-[color,box-shadow] outline-none placeholder:text-[var(--sg-text-faint)] focus-visible:shadow-[var(--sg-shadow-raised),0_0_0_3px_color-mix(in_srgb,var(--sg-text)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[0_0_0_1px_var(--destructive)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
