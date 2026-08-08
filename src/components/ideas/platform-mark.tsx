import { Link2, Music2 } from "lucide-react";
import type { Platform } from "@/lib/inspiration/types";

/**
 * A reference link's platform, as its brand mark. Brand colors are the one
 * legitimate hard-coded palette: Instagram's gradient is Instagram's, not
 * ours, and theming it would make the mark unrecognizable.
 */
export default function PlatformMark({ platform }: { platform: Platform }) {
  if (platform === "instagram") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[radial-gradient(circle_at_68%_68%,#ffd600_0_18%,#ff7a00_32%,#ff0169_56%,#d300c5_76%,#7638fa_100%)] text-white shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle cx="17.7" cy="6.7" r="1.15" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (platform === "youtube") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[#ff0033] text-white shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path d="m9.5 7.8 7 4.2-7 4.2Z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (platform === "tiktok") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-black text-white shadow-sm ring-1 ring-white/10">
        <Music2 aria-hidden="true" className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground grid h-6 w-6 shrink-0 place-items-center rounded-[6px]">
      <Link2 aria-hidden="true" className="h-4 w-4" />
    </span>
  );
}
