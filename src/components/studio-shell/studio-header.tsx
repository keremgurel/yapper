"use client";

import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { studioNav } from "@/data/studio-nav";
import UserMenu from "@/components/account/user-menu";
import StudioContentFrame from "@/components/studio-shell/studio-content-frame";

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

  return (
    <div className="bg-background/80 sticky top-[var(--site-header,3.5rem)] z-20 flex h-12 shrink-0 items-center border-b px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <SidebarTrigger className="absolute left-2" />
      <StudioContentFrame className="flex min-w-0 items-center gap-2 pl-8">
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-5"
        />
        <span className="font-display text-foreground min-w-0 flex-1 truncate text-[15px] font-semibold">
          {currentTitle(pathname)}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Show when="signed-in">
            <UserMenu />
          </Show>
          <div className="ml-1 h-8 w-[52px] shrink-0">
            <div className="origin-top-left scale-50">
              <CinematicThemeSwitcher />
            </div>
          </div>
        </div>
      </StudioContentFrame>
    </div>
  );
}
