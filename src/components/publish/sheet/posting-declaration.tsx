"use client";

import { useId } from "react";

const POLICY_LINK = "underline underline-offset-4";

/**
 * The one confirmation a post asks for, beside the publish button. It covers
 * every chosen destination; today TikTok is the only one with terms the
 * creator has to accept each time, and its wording is TikTok's own.
 */
export default function PostingDeclaration({
  checked,
  onChange,
  disabled,
  branded,
  videos,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  /** Branded content adds TikTok's Branded Content Policy to the terms. */
  branded: boolean;
  videos: number;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[color:var(--sg-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="min-w-0">
        I reviewed {videos === 1 ? "this video" : "these videos"} and authorize
        posting. By posting, you agree to TikTok’s{" "}
        {branded && (
          <>
            <a
              className={POLICY_LINK}
              href="https://www.tiktok.com/legal/page/global/bc-policy/en"
              target="_blank"
              rel="noreferrer"
            >
              Branded Content Policy
            </a>{" "}
            and{" "}
          </>
        )}
        <a
          className={POLICY_LINK}
          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
          target="_blank"
          rel="noreferrer"
        >
          Music Usage Confirmation
        </a>
        .
      </label>
    </div>
  );
}
