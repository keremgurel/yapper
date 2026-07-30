"use client";

import type { CSSProperties } from "react";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StudioProvider } from "@/components/studio/studio-context";
import StudioWorkspace from "@/components/studio/studio-workspace";

/**
 * The editor. Full-height, its own workspace. In the desktop app it wears the
 * same focused shell on web and desktop: the collapsed Studio rail stays on
 * the left, but the marketing website navbar never takes editing space.
 */
export default function StudioPage() {
  return (
    <StudioProvider>
      <div
        className="bg-background flex h-[100dvh] flex-col overflow-hidden"
        style={{ "--site-header": "0rem" } as CSSProperties}
      >
        <SidebarProvider defaultOpen={false} className="min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
            <StudioHeader />
            <main className="flex min-h-0 flex-1 flex-col">
              <StudioWorkspace />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </StudioProvider>
  );
}
