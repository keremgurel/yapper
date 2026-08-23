"use client";

import { Loader2, Sparkles } from "lucide-react";
import UsageSelect from "@/components/brain/blocks/usage-select";
import { Chip } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describePaste } from "@/lib/brain/detect";
import type { IngestDraft, IngestProposal } from "@/lib/brain/ingest-client";

/**
 * What was parsed, before anything is saved.
 *
 * The creator sees the real shape first, because that is the part that is
 * already true: the browser has the whole import in hand and can prove it read
 * the columns right. Naming is offered as a separate button rather than done
 * automatically, since it is the only step that costs a credit and a creator
 * who already knows what to call this should not pay for a suggestion.
 */
export default function ProposalPreview({
  draft,
  naming,
  onEdit,
  onName,
  onSave,
  saving,
}: {
  draft: IngestDraft;
  naming: boolean;
  onEdit: (patch: Partial<IngestProposal>) => void;
  onName: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { detected, proposal } = draft;

  return (
    <div className="space-y-4">
      <div className="bg-muted space-y-2 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Chip tone="cyan">{detected.kind}</Chip>
          <span className="text-muted-foreground text-xs">
            {describePaste(detected)}
          </span>
        </div>
        <pre className="text-foreground/80 max-h-40 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {detected.sample.slice(0, 1200)}
        </pre>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="ingest-title" className="sg-field-label">
            Call it
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onName}
            disabled={naming}
          >
            {naming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Name it for me
          </Button>
        </div>
        <Input
          id="ingest-title"
          value={proposal.title}
          placeholder="Content gaps from TikTok search"
          onChange={(event) => onEdit({ title: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ingest-digest" className="sg-field-label">
          What it is, in one line
        </Label>
        <Input
          id="ingest-digest"
          value={proposal.digest}
          placeholder="Search terms with thin answers, use when picking a topic"
          onChange={(event) => onEdit({ digest: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ingest-tags" className="sg-field-label">
          Tags
        </Label>
        <Input
          id="ingest-tags"
          value={proposal.tags.join(", ")}
          placeholder="pricing, gaps"
          onChange={(event) =>
            onEdit({
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 4),
            })
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="sg-field-label">Read it</span>
          <UsageSelect
            usage={proposal.usage}
            onChange={(usage) => onEdit({ usage })}
          />
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || !proposal.title.trim()}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add to brain
        </Button>
      </div>
    </div>
  );
}
