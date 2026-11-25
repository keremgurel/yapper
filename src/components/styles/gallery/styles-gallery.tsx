"use client";

import { useMemo } from "react";
import { PageHeader, Section } from "@/components/studio-ui";
import { getStyle } from "@/lib/style-library/registry";
import { describeTemplate } from "@/lib/style-library/templates/describe-template";
import { blockItems, lookItem, templateItems } from "./gallery-item";
import ItemList from "./item-list";
import PlaceInspector from "./place-inspector";
import PlacesList from "./places-list";
import RulesList from "./rules-list";
import SaveLook from "./save-look";
import StagePanel from "./stage-panel";
import { useLooks } from "./use-looks";
import { useWorkbench } from "./use-workbench";

const LIBRARY = [...templateItems(), ...blockItems()];

/**
 * The style library as a place to work: pick a template or a block, watch it
 * play, change any part of it, and keep the result as a look.
 */
export default function StylesGallery() {
  const { looks, state, saveNew, saveChanges } = useLooks();
  const bench = useWorkbench(LIBRARY[0]);
  const items = useMemo(
    () => [...templateItems(), ...looks.map(lookItem), ...blockItems()],
    [looks],
  );
  const places = useMemo(
    () => describeTemplate(bench.template).places,
    [bench.template],
  );
  const place =
    places.find((candidate) => candidate.path === bench.place) ?? places[0];
  const rules = place?.block
    ? (getStyle(place.block.styleId)?.rules ?? [])
    : [];

  return (
    <>
      <PageHeader
        title="Styles"
        description="Templates and the blocks they are built from. Open one, change any part of it, and save it as your look."
      />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-8">
        <ItemList
          items={items}
          selectedKey={bench.item.key}
          onOpen={bench.open}
        />

        <div className="lg:sticky lg:top-20 lg:self-start">
          <StagePanel
            key={bench.item.key}
            template={bench.template}
            durationS={bench.item.durationS}
            notice={bench.notice}
          />
        </div>

        <aside className="space-y-8">
          <SaveLook
            key={bench.item.key}
            item={bench.item}
            editCount={bench.edits.length}
            available={state !== "unavailable"}
            onSaveNew={async (name) => {
              const saved = await saveNew(
                bench.item.saveFrom!,
                name,
                bench.edits,
              );
              // The preview keeps what is on screen; the item is now the saved look.
              bench.settle({ ...lookItem(saved), template: bench.template });
            }}
            onSaveChanges={async () => {
              const saved = await saveChanges(bench.item.lookId!, bench.edits);
              bench.settle({ ...lookItem(saved), template: bench.template });
            }}
          />
          <Section title="Parts">
            <PlacesList
              places={places}
              selected={place.path}
              onSelect={bench.selectPlace}
            />
          </Section>
          <Section title={place.block?.name ?? place.label}>
            <PlaceInspector place={place} onEdit={bench.apply} />
          </Section>
          {rules.length > 0 && (
            <Section title="Why it looks like this" rank="quiet">
              <RulesList rules={rules} />
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
