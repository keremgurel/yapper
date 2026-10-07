"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import ProjectBrainSheet from "@/components/project/project-brain-sheet";
import { Button } from "@/components/ui/button";

/** Opens the project brain from the Studio header. Owns only the open flag, so
 * the sheet (and its fetch) stay inert until a creator actually asks for it. */
export default function ProjectBrainButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Project context"
        title="Project context: what you make, who it's for, how you sound"
        className="text-muted-foreground hover:text-foreground size-8 gap-1.5 p-0 has-[>svg]:px-0 lg:w-auto lg:px-2.5 lg:has-[>svg]:px-2.5"
      >
        <Brain className="h-4 w-4" />
        <span className="hidden text-xs font-semibold lg:inline">Project</span>
      </Button>
      <ProjectBrainSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
