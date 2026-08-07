"use client";

import Link from "next/link";
import { ArrowLeft, Trash2, Video } from "lucide-react";
import CopyScriptButton from "@/components/library/copy-script-button";
import { Button } from "@/components/ui/button";
import { hookTexts } from "@/lib/content/normalize";
import type { ContentDetail } from "@/lib/content/client";

/** The item's title and the actions that act on the item as a whole. */
export default function WorkbenchHeader({
  item,
  onTitleChange,
  onDelete,
}: {
  item: ContentDetail;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="text-muted-foreground mb-3 -ml-2"
      >
        <Link href="/studio/library">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3">
        <input
          value={item.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Idea title"
          aria-label="Idea title"
          className="text-foreground placeholder:text-muted-foreground/60 w-full bg-transparent text-3xl font-black tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/studio/recorder?item=${item.id}`}>
              <Video className="h-4 w-4" />
              Record
            </Link>
          </Button>
          <CopyScriptButton idea={{ ...item, hooks: hookTexts(item.hooks) }} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
