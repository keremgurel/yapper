"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { studioNav } from "@/data/studio-nav";

function currentTitle(pathname: string): string {
  const match = studioNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Studio";
}

/** Thin subheader inside the SidebarInset: the sidebar toggle + the current
 * surface's name. Account + theme live in the global site navbar above this. */
export default function StudioHeader() {
  const pathname = usePathname();

  return (
    <div className="bg-background/80 sticky top-14 z-20 flex h-12 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-5"
      />
      <span className="font-display text-foreground text-[15px] font-semibold">
        {currentTitle(pathname)}
      </span>
    </div>
  );
}
