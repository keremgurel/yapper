"use client";

import TrainingHeader from "@/components/training/training-header";
import { StudioProvider } from "@/components/studio/studio-context";
import StudioWorkspace from "@/components/studio/studio-workspace";

export default function StudioPage() {
  return (
    <StudioProvider>
      <div className="bg-background min-h-screen">
        <TrainingHeader />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto mb-6 max-w-4xl">
            <h1 className="text-foreground text-3xl font-black tracking-tight">
              Studio
            </h1>
            <p className="text-foreground/55 mt-1 text-sm">
              Transcript-aware video editing in your browser. Trim, split, and
              cut silences — no upload, no account.
            </p>
          </div>
          <StudioWorkspace />
        </div>
      </div>
    </StudioProvider>
  );
}
