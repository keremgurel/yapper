"use client";

import { useState } from "react";
import TrainingHeader from "@/components/training/training-header";
import AddLinkDialog from "@/components/inspiration/add-link-dialog";
import InspirationBoard from "@/components/inspiration/inspiration-board";
import { InspirationProvider } from "@/components/inspiration/inspiration-context";
import PillarSidebar from "@/components/inspiration/pillar-sidebar";

export default function InspirationPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <InspirationProvider>
      <div className="bg-background min-h-screen">
        <TrainingHeader />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
          <PillarSidebar />
          <InspirationBoard onAdd={() => setDialogOpen(true)} />
        </div>
        <AddLinkDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </div>
    </InspirationProvider>
  );
}
