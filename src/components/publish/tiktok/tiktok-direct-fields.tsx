"use client";

import {
  allowedTikTokAudiences,
  type TikTokPostChoices,
} from "@/lib/publish/tiktok-direct-defaults";
import type { TikTokPrivacy } from "@/lib/publish/tiktok-direct-settings";
import TikTokCommercialFields from "./tiktok-commercial-fields";
import {
  settingsCheckRow,
  settingsCheckbox,
  settingsSelect,
} from "./tiktok-field-styles";
import { TIKTOK_AUDIENCE_LABELS } from "./tiktok-review";
import type { TikTokCreatorContext } from "./use-tiktok-creator";

const INTERACTIONS = [
  ["allowComment", "Allow comments", "comment_disabled"],
  ["allowDuet", "Allow Duet", "duet_disabled"],
  ["allowStitch", "Allow Stitch", "stitch_disabled"],
] as const;

/**
 * The Direct Post choices for one video: who can see it, what others may do
 * with it, and how it is labeled. They arrive filled in and stay editable.
 */
export default function TikTokDirectFields({
  context,
  settings,
  onChange,
}: {
  context: TikTokCreatorContext;
  settings: TikTokPostChoices;
  onChange: (next: TikTokPostChoices) => void;
}) {
  const { creator } = context;
  return (
    <>
      <label className="flex flex-col gap-2">
        Who can see this video?
        <select
          value={settings.privacy}
          className={settingsSelect}
          onChange={(event) =>
            onChange({
              ...settings,
              privacy: event.target.value as TikTokPrivacy,
            })
          }
        >
          <option value="" disabled>
            Choose an audience
          </option>
          {allowedTikTokAudiences(creator, context.audited).map((privacy) => (
            <option
              key={privacy}
              value={privacy}
              disabled={privacy === "SELF_ONLY" && settings.brandedContent}
            >
              {TIKTOK_AUDIENCE_LABELS[privacy] ?? privacy}
            </option>
          ))}
        </select>
      </label>
      <div>
        {INTERACTIONS.map(([key, label, disabledBy]) => {
          const blocked = creator[disabledBy];
          return (
            <label
              key={key}
              className={`${settingsCheckRow} ${blocked ? "text-muted-foreground" : ""}`}
            >
              <input
                type="checkbox"
                className={settingsCheckbox}
                checked={settings[key]}
                disabled={blocked}
                onChange={(event) =>
                  onChange({ ...settings, [key]: event.target.checked })
                }
              />
              {label}
              {blocked ? " (disabled in TikTok)" : ""}
            </label>
          );
        })}
        <TikTokCommercialFields settings={settings} onChange={onChange} />
        <label className={settingsCheckRow}>
          <input
            type="checkbox"
            className={settingsCheckbox}
            checked={settings.aiGenerated}
            onChange={(event) =>
              onChange({ ...settings, aiGenerated: event.target.checked })
            }
          />
          Label this video as AI-generated
        </label>
      </div>
    </>
  );
}
