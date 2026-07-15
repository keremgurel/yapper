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
import {
  studioFlowNav,
  studioUtilityNav,
  type StudioNavItem,
} from "@/data/studio-nav";

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

/** The Studio workflow nav rail. Sits BELOW the global site navbar (which
 * carries the logo + account), so it holds only the Studio surfaces. The main
 * workflow leads; the supporting surfaces (Connections, and later Settings and
 * automations) sit in their own labeled "Setup" group right under the flow, so
 * they read as separate plumbing rather than a buried footer afterthought.
 * Collapses to an icon rail on desktop, a sheet on mobile. The `top-14` offset
 * keeps the fixed rail under the 56px sticky header. */
export default function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="top-14 h-[calc(100svh-3.5rem)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Studio</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={studioFlowNav} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={studioUtilityNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
