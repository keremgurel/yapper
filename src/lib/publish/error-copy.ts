/** User-facing guidance shared by Poster and the single-platform composer. */
export function publishErrorCopy(error: string): string {
  if (error === "facebook_video_requirements")
    return "Facebook Reels require a vertical video, 3–90 seconds long, at least 540 × 960 pixels.";
  if (error === "facebook_page_required")
    return "Choose your Facebook Page in Connections first.";
  if (error === "tiktok_audit_required")
    return "Public Direct Post is waiting for TikTok approval. Use Only me for testing or choose the inbox method.";
  if (error === "tiktok_scope_not_authorized")
    return "Reconnect TikTok to grant Direct Post access, or choose the inbox method.";
  if (error === "facebook_reauth_required")
    return "Reconnect Facebook in Connections to renew publishing access.";
  if (error.startsWith("facebook_")) return `Facebook: ${error.slice(9)}`;

  if (error === "publish_in_progress")
    return "Delivery is not confirmed yet. Use Check publish status to check this upload again without sending another copy.";
  if (
    error === "not_connected" ||
    /tiktok_(access_token_invalid|scope_not_authorized|auth_removed)$/.test(
      error,
    )
  )
    return "Reconnect your account in Connections, then check this attempt again.";
  if (error === "tiktok_spam_risk_too_many_pending_share")
    return "TikTok’s pending-upload limit has been reached (up to 5 within 24 hours). Finish existing uploads in TikTok’s Inbox and wait for the limit to clear.";
  if (
    /tiktok_(file_format|duration|frame_rate|picture_size)_check_failed$/.test(
      error,
    )
  )
    return `TikTok rejected the video (${error.slice(7)}). Export it again with a supported format, duration, frame rate and dimensions.`;
  if (error.startsWith("tiktok_spam_risk"))
    return `TikTok blocked this upload (${error.slice(7)}). Check your account in TikTok before trying a new upload.`;
  if (error.startsWith("tiktok_"))
    return `TikTok could not deliver this video (${error.slice(7)}).`;
  if (error === "publish_attempt_failed")
    return "This attempt failed. Start a new publish only after resolving the problem.";
  return "Couldn’t post. Check your connection and try again.";
}
