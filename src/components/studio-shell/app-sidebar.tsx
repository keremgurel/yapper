"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
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

/** The Studio nav rail. Sits BELOW the global site navbar (logo + account), so
 * it holds only the Studio surfaces, grouped by stage: Lab (where ideas come
 * from), Studio (make the video), Press (send it out), Settings (one-time
 * plumbing). Each group is a labeled section from `studioNavGroups`. Collapses
 * to an icon rail on desktop, a sheet on mobile. The `top-14` offset keeps the
 * fixed rail under the 56px sticky header. */
export default function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="top-14 h-[calc(100svh-3.5rem)]">
      <SidebarContent>
        {studioNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
