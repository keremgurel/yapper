"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { studioNav } from "@/data/studio-nav";
import UserMenu from "@/components/account/user-menu";
import BillingStatusButton from "@/components/billing/billing-status-button";
import StudioContentFrame from "@/components/studio-shell/studio-content-frame";
import ProjectBrainButton from "@/components/project/project-brain-button";

function currentTitle(pathname: string): string {
  const match = studioNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Studio";
}

/** Universal app header: navigation context on the left and persistent
 * account/display controls on the right. Video editing lives in the native
 * app, so the web shell never carries editor workspace state. */
export default function StudioHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

  return (
    <div className="bg-background/80 sticky top-[var(--site-header,3.5rem)] z-20 flex h-12 shrink-0 items-center border-b px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <StudioContentFrame className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-5"
        />
        <span className="font-display text-foreground min-w-0 flex-1 truncate text-[15px] font-semibold">
          {currentTitle(pathname)}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Show when="signed-in">
            <ProjectBrainButton />
            <BillingStatusButton compact />
            <UserMenu />
          </Show>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
            title={`Switch to ${dark ? "light" : "dark"} mode`}
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </StudioContentFrame>
    </div>
  );
}
