"use client";

import { useEffect, type CSSProperties } from "react";
import AppSidebar from "@/components/studio-shell/app-sidebar";
import StudioHeader from "@/components/studio-shell/studio-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useStudio } from "@/components/studio/studio-context";
import StudioWorkspace from "@/components/studio/studio-workspace";
import { EditorLayoutProvider } from "@/components/studio/editor-layout-context";
import { consumePendingVideo } from "@/lib/studio/handoff";
import { loadLinkedRecording } from "@/lib/studio/load-linked-recording";
import { loadVideoSource } from "@/lib/studio/load-source";
import StudioContentFrame from "@/components/studio-shell/studio-content-frame";

/**
 * Imports are an Editor-page concern even though the resulting project lives
 * above the page. This runs whenever the Editor is entered, so Content Library
 * handoffs still work after visiting another Studio section first.
 */
function EditorEntryLoader() {
  const { loadSource } = useStudio();

  useEffect(() => {
    const blob = consumePendingVideo();
    if (blob) {
      loadVideoSource(blob, "Practice take")
        .then(loadSource)
        .catch(() => {});
      return;
    }

    const itemId = new URLSearchParams(window.location.search).get("item");
    if (!itemId) return;
    loadLinkedRecording(itemId)
      .then((recording) => {
        if (!recording) return;
        return loadVideoSource(recording.blob, recording.name).then(loadSource);
      })
      .catch((error) => {
        console.warn("Could not load the linked recording", error);
      });
  }, [loadSource]);

  return null;
}

/**
 * The editor. Full-height, its own workspace. In the desktop app it wears the
 * same focused shell on web and desktop: the collapsed Studio rail stays on
 * the left, but the marketing website navbar never takes editing space.
 */
export default function StudioPage() {
  return (
    <div
      className="bg-background flex h-[100dvh] flex-col overflow-hidden"
      style={{ "--site-header": "0rem" } as CSSProperties}
    >
      <EditorEntryLoader />
      <EditorLayoutProvider>
        <SidebarProvider defaultOpen={false} className="min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
            <StudioHeader />
            <main className="flex min-h-0 flex-1 flex-col">
              <StudioContentFrame
                fluid
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <StudioWorkspace />
              </StudioContentFrame>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </EditorLayoutProvider>
    </div>
  );
}
