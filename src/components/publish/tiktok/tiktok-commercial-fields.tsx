"use client";

import type { TikTokPostChoices } from "@/lib/publish/tiktok-direct-defaults";
import { settingsCheckRow, settingsCheckbox } from "./tiktok-field-styles";

/**
 * TikTok's commercial disclosure: off unless the creator says the video
 * promotes something, then one or both of their own brand and a third party.
 */
export default function TikTokCommercialFields({
  settings,
  onChange,
}: {
  settings: TikTokPostChoices;
  onChange: (next: TikTokPostChoices) => void;
}) {
  const isPrivate = settings.privacy === "SELF_ONLY";
  return (
    <>
      <label className={settingsCheckRow}>
        <input
          type="checkbox"
          className={settingsCheckbox}
          checked={settings.discloseCommercial}
          onChange={(event) =>
            onChange({
              ...settings,
              discloseCommercial: event.target.checked,
              ownBrand: false,
              brandedContent: false,
            })
          }
        />
        Disclose commercial content
      </label>
      {settings.discloseCommercial && (
        <div className="space-y-1 pl-7">
          <label className={settingsCheckRow}>
            <input
              type="checkbox"
              className={settingsCheckbox}
              checked={settings.ownBrand}
              onChange={(event) =>
                onChange({ ...settings, ownBrand: event.target.checked })
              }
            />
            Your brand
          </label>
          <label
            className={`${settingsCheckRow} ${isPrivate ? "text-muted-foreground" : ""}`}
          >
            <input
              type="checkbox"
              className={settingsCheckbox}
              checked={settings.brandedContent}
              disabled={isPrivate}
              onChange={(event) =>
                onChange({ ...settings, brandedContent: event.target.checked })
              }
            />
            Branded content
          </label>
          {isPrivate && (
            <p className="text-xs">
              Branded content visibility cannot be set to private.
            </p>
          )}
          {settings.ownBrand || settings.brandedContent ? (
            <p className="text-xs">
              Your video will be labeled as “
              {settings.brandedContent
                ? "Paid partnership"
                : "Promotional content"}
              ”.
            </p>
          ) : (
            <p className="text-xs">
              Indicate whether this promotes your brand, a third party, or both.
            </p>
          )}
        </div>
      )}
    </>
  );
}
