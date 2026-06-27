import { PLATFORM_LABEL } from "@/lib/inspiration/platform";
import type { Platform } from "@/lib/inspiration/types";

const styles: Record<Platform, string> = {
  youtube: "bg-red-500/15 text-red-600 dark:text-red-300",
  tiktok: "bg-slate-900/10 text-slate-700 dark:bg-white/15 dark:text-white",
  instagram: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  unknown: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

export default function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide uppercase ${styles[platform]}`}
    >
      {PLATFORM_LABEL[platform]}
    </span>
  );
}
