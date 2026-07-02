"use client";

import { useState } from "react";
import AddLinkDialog from "@/components/inspiration/add-link-dialog";
import InspirationBoard from "@/components/inspiration/inspiration-board";
import { InspirationProvider } from "@/components/inspiration/inspiration-context";
import PillarSidebar from "@/components/inspiration/pillar-sidebar";

/** The Inspiration surface, rendered inside the Studio dashboard shell (the
 * shell owns the header and page frame). */
export default function InspirationPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <InspirationProvider>
      <div className="flex flex-col gap-8 lg:flex-row">
        <PillarSidebar />
        <InspirationBoard onAdd={() => setDialogOpen(true)} />
      </div>
      <AddLinkDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </InspirationProvider>
  );
}
