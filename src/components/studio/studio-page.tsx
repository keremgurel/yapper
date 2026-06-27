"use client";

import TrainingHeader from "@/components/training/training-header";
import { StudioProvider } from "@/components/studio/studio-context";
import StudioWorkspace from "@/components/studio/studio-workspace";

export default function StudioPage() {
  return (
    <StudioProvider>
      <div className="bg-background flex h-[100dvh] flex-col overflow-hidden">
        <TrainingHeader />
        <main className="flex min-h-0 flex-1 flex-col">
          <StudioWorkspace />
        </main>
      </div>
    </StudioProvider>
  );
}
