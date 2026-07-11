"use client";

import { useState } from "react";
import AddLinkDialog from "@/components/inspiration/add-link-dialog";
import InspirationBoard from "@/components/inspiration/inspiration-board";
import InspirationEmptyState from "@/components/inspiration/inspiration-empty-state";
import {
  InspirationProvider,
  useInspiration,
} from "@/components/inspiration/inspiration-context";
import PillarSidebar from "@/components/inspiration/pillar-sidebar";
import StudioSetupPrompt from "@/components/onboarding/studio-setup-prompt";

/** Switches between the clean first-run story (no items yet) and the full board
 * with its pillar rail. Keeping the blank state uncluttered is deliberate — a
 * new user should see one idea and one action, not a rail full of empty
 * folders. */
function InspirationContent({ onAdd }: { onAdd: () => void }) {
  const { ready, items } = useInspiration();

  if (ready && items.length === 0) {
    return <InspirationEmptyState onAdd={onAdd} />;
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <PillarSidebar />
      <InspirationBoard onAdd={onAdd} />
    </div>
  );
}

/** The Inspiration surface, rendered inside the Studio dashboard shell (the
 * shell owns the header and page frame). Setup is offered here via an explicit
 * prompt — a signed-in user who hasn't onboarded sees a "Set up studio" card
 * and opens the full-screen flow themselves. */
export default function InspirationPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <InspirationProvider>
      <StudioSetupPrompt />
      <InspirationContent onAdd={() => setDialogOpen(true)} />
      <AddLinkDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </InspirationProvider>
  );
}
