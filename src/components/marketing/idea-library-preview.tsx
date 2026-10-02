"use client";

import { Check } from "lucide-react";
import ItemTable from "@/components/items/item-table";
import ItemCell from "@/components/items/item-cell";
import type { ContentSummary } from "@/lib/content/client";
import { demoIdeas } from "./demo-content";

const noop = () => {};
const noSelection = new Set<string>();
const fields = [
  { key: "pillar", label: "Pillar" },
  { key: "type", label: "Type" },
  { key: "formats", label: "Format" },
  { key: "status", label: "Status" },
] as const;

export function IdeaLibraryScene({
  rows = demoIdeas,
  added = false,
}: {
  rows?: ContentSummary[];
  added?: boolean;
}) {
  return (
    <div className="idea-library-scene">
      <div className="studio-panel-heading">
        <p className="demo-heading">
          {added ? "Your idea bank" : "Content library"}
        </p>
        <span>
          {added ? (
            <>
              <Check size={13} />
              Idea organized
            </>
          ) : (
            `${rows.length} projects`
          )}
        </span>
      </div>
      <div className="idea-library-desktop">
        <div inert>
          <ItemTable
            rows={rows}
            columns={["title", "pillar", "type", "formats", "status"]}
            sort={{ key: "added", dir: "desc" }}
            onToggleSort={noop}
            selectedIds={noSelection}
            onToggleSelect={noop}
            onSelectAll={noop}
            onOpen={noop}
            onStatus={noop}
            onPost={noop}
            emptyLabel="Your next idea starts here"
          />
        </div>
      </div>
      <div className="idea-library-mobile" inert>
        {rows.map((row) => (
          <article className="idea-library-record" key={row.id}>
            <h3>{row.title}</h3>
            <dl>
              {fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    <ItemCell
                      column={field.key}
                      row={row}
                      onStatus={noop}
                      onPost={noop}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
export default function LibraryPreview() {
  return (
    <div
      className="library-only-demo"
      role="img"
      aria-label="Content library with projects organized by pillar, originality, format, and production status."
    >
      <div aria-hidden="true">
        <IdeaLibraryScene />
      </div>
    </div>
  );
}
