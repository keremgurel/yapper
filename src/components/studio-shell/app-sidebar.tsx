"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import StudioNavIcon from "@/components/studio-shell/studio-nav-icon";
import { studioNavGroups, type StudioNavItem } from "@/data/studio-nav";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavMenu({ items }: { items: StudioNavItem[] }) {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, item.href)}
            tooltip={item.title}
          >
            <Link href={item.href} className="no-underline">
              <StudioNavIcon icon={item.icon} />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** The Studio nav rail: the app's mark at the top, then the Studio surfaces,
 * grouped by stage: Lab (where ideas come from), Studio (make the video),
 * Press (send it out), Settings (one-time plumbing). Each group is a labeled
 * section from `studioNavGroups`. Collapses to an icon rail on desktop, a
 * sheet on mobile. */
export default function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="top-[var(--site-header,3.5rem)] h-[calc(100svh-var(--site-header,3.5rem))]"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Yapper Studio">
              <Link href="/studio/home" className="no-underline">
                <ChirpyMark size={24} />
                <span className="text-[17px] font-semibold tracking-[-0.03em]">
                  yapper{" "}
                  <span className="text-muted-foreground font-normal">
                    studio
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {studioNavGroups.map((group) => (
          <SidebarGroup key={group.label || "home"}>
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <NavMenu items={group.items} />
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
