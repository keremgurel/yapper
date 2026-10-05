import { Show } from "@clerk/nextjs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import StudioGate from "@/components/studio-shell/studio-gate";
import AppChrome from "@/components/studio-shell/app-chrome";
import StudioContentFrame from "@/components/studio-shell/studio-content-frame";
import StudioChirpy from "@/components/studio-shell/studio-chirpy";
import PaywallDialog from "@/components/billing/paywall-dialog";
import { automationsEnabled } from "@/lib/publish/automation-types";

/**
 * The Studio dashboard shell, on its own without the website's navbar: a
 * shadcn sidebar app-shell (collapsible icon rail
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
    // Studio is an app, not a page of the website: no site navbar, so the
    // height the shell reserved for it is zero.
    <div
      className="flex min-h-svh flex-col"
      style={{ "--site-header": "0px" } as React.CSSProperties}
    >
      {/* Flags the desktop shell so we can drop website chrome (web: no-op). */}
      <AppChrome />
      <StudioChirpy>
        <SidebarProvider className="min-h-[calc(100svh-var(--site-header,3.5rem))] flex-1">
          {/* Automations cannot run until the server turns them on, so the
              entry stays out of the way instead of inviting a rule that
              never fires. */}
          <AppSidebar
            hiddenHrefs={automationsEnabled() ? [] : ["/studio/automations"]}
          />
          <SidebarInset className="min-h-[calc(100svh-var(--site-header,3.5rem))]">
            <StudioHeader />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Show when="signed-in">
                <StudioContentFrame>{children}</StudioContentFrame>
                <PaywallDialog />
              </Show>
              <Show when="signed-out">
                <StudioGate />
              </Show>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </StudioChirpy>
    </div>
  );
}
