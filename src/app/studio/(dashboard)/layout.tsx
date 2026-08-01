import { Show } from "@clerk/nextjs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import TrainingHeader from "@/components/training/training-header";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import StudioGate from "@/components/studio-shell/studio-gate";
import AppChrome from "@/components/studio-shell/app-chrome";
import StudioContentFrame from "@/components/studio-shell/studio-content-frame";

/**
 * The Studio dashboard shell: a shadcn sidebar app-shell (collapsible icon rail
 * + inset content with a sticky header). The editor keeps its own full-screen
 * visual shell outside this route group, while the transparent /studio layout
 * owns the shared project session across both shells.
 */
export default function StudioDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Flags the desktop shell so we can drop website chrome (web: no-op). */}
      <AppChrome />
      {/* Global site navbar — website only. In the native app it's hidden and
          its height reservation (--site-header) collapses to 0. */}
      <div className="marketing-chrome">
        <TrainingHeader />
      </div>
      <SidebarProvider className="min-h-[calc(100svh-var(--site-header,3.5rem))] flex-1">
        <AppSidebar />
        <SidebarInset className="min-h-[calc(100svh-var(--site-header,3.5rem))]">
          <StudioHeader />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Show when="signed-in">
              <StudioContentFrame>{children}</StudioContentFrame>
            </Show>
            <Show when="signed-out">
              <StudioGate />
            </Show>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
