"use client";

import TrainingHeader from "@/components/training/training-header";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StudioProvider } from "@/components/studio/studio-context";
import StudioWorkspace from "@/components/studio/studio-workspace";

/**
 * The editor. Full-height, its own workspace. In the desktop app it wears the
 * same shell as the rest of Studio: the collapsed sidebar rail stays on the
 * left so you always have nav, and the marketing navbar is hidden. On the web
 * the navbar shows and the rail sits below it.
 */
export default function StudioPage() {
  return (
    <StudioProvider>
      <div className="bg-background flex h-[100dvh] flex-col overflow-hidden">
        <div className="marketing-chrome">
          <TrainingHeader />
        </div>
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
