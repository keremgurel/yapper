import TrainingHeader from "@/components/training/training-header";
import StudioSidebar from "@/components/studio-shell/studio-sidebar";

/**
 * The Studio dashboard shell: header + left nav rail (tab strip on mobile).
 * Everything "up until the editor" lives in here; the editor keeps its own
 * full-screen layout at /studio/editor OUTSIDE this route group. Do not add a
 * src/app/studio/layout.tsx (it would wrap the editor) or a page.tsx inside
 * this group (it would conflict with the /studio redirect).
 */
export default function StudioDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-screen">
      <TrainingHeader />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="lg:flex">
          <StudioSidebar />
          <main className="min-w-0 flex-1 py-6 lg:py-8 lg:pl-2">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
