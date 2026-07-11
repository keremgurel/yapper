import { Show } from "@clerk/nextjs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import TrainingHeader from "@/components/training/training-header";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import StudioGate from "@/components/studio-shell/studio-gate";

/**
 * The Studio dashboard shell: a shadcn sidebar app-shell (collapsible icon rail
 * + inset content with a sticky header). Everything "up until the editor" lives
 * here; the editor keeps its own full-screen layout at /studio/editor OUTSIDE
 * this route group. Do not add a src/app/studio/layout.tsx (it would wrap the
 * editor) or a page.tsx inside this group (it would conflict with the /studio
 * redirect).
 */
export default function StudioDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Global site navbar on top, consistent with the rest of the site. */}
      <TrainingHeader />
      <SidebarProvider className="min-h-[calc(100svh-3.5rem)] flex-1">
        <AppSidebar />
        <SidebarInset className="min-h-[calc(100svh-3.5rem)]">
          <StudioHeader />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Show when="signed-in">{children}</Show>
            <Show when="signed-out">
              <StudioGate />
            </Show>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
