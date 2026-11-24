"use client";

import type { TemplateEdit } from "@/lib/style-library/templates/edit-template";
import type { PlaceDescription } from "@/lib/style-library/templates/describe-template";
import { getStyle } from "@/lib/style-library/registry";
import SettingControl from "../controls/setting-control";
import BlockSwap from "./block-swap";

/** Controls for the selected place: which block is in it, then that block's content and look. */
export default function PlaceInspector({
  place,
  onEdit,
}: {
  place: PlaceDescription;
  onEdit: (edit: TemplateEdit) => void;
}) {
  const style = place.block ? getStyle(place.block.styleId) : undefined;
  const at = place.path;
  return (
    <div className="divide-border/60 divide-y">
      {place.canHold.length > 1 || !place.block ? (
        <BlockSwap
          current={place.block?.styleId ?? null}
          canHold={place.canHold}
          onPick={(styleId) => onEdit({ op: "setBlock", at, styleId })}
          onClear={() => onEdit({ op: "clear", at })}
        />
      ) : null}
      {style &&
        place.block?.content
          // The take and the transcript belong to the video, not to the look.
          .filter(
            (setting) =>
              setting.key !== "take" &&
              setting.kind !== "words" &&
              setting.kind !== "windows",
          )
          .map((setting) => (
            <SettingControl
              key={`content:${setting.key}`}
              spec={style.content[setting.key]}
              value={setting.value}
              sample={style.preview.content[setting.key]}
              onChange={(value) =>
                onEdit({
                  op: "setContent",
                  at,
                  content: { [setting.key]: value },
                })
              }
            />
          ))}
      {style &&
        place.block?.options.map((setting) => (
          <SettingControl
            key={`option:${setting.key}`}
            spec={style.options[setting.key]}
            value={setting.value}
            onChange={(value) =>
              onEdit({
                op: "setOptions",
                at,
                options: { [setting.key]: value },
              })
            }
          />
        ))}
    </div>
  );
}
