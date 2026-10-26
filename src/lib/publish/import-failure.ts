/**
 * What a failed import means to the creator, in their terms.
 *
 * The route already distinguishes twenty-three ways this can go wrong, and the
 * Poster threw all of them away for one sentence about an original that could
 * not be prepared. A creator reading that cannot tell that they are out of
 * imports for the hour from that Instagram never gave the app a file, and the
 * two have completely different answers.
 */
export function importFailureMessage(
  code: string | undefined,
  platform = "instagram",
): string {
  const name = platform === "tiktok" ? "TikTok" : "Instagram";
  switch (code) {
    case "rate_limited":
      if (platform === "tiktok")
        return "Imports are busy. Wait a few minutes before trying again.";
      return "You have imported as many originals as this hour allows. Try again shortly.";
    case "not_owned":
      return "That video does not belong to your connected TikTok account.";
    case "provider_budget_unavailable":
      return "The import budget is unavailable right now. Try again later.";
    case "import_unavailable":
      return "TikTok imports are unavailable right now. Try again later.";
    case "not_entitled":
      return "Importing an original needs an active subscription.";
    case "poster_slot_busy":
      return "Post or remove your waiting video before importing another.";
    case "storage_full":
      return "Your storage is full. Delete something from the library and try again.";
    case "too_many_pending_uploads":
      return "There are too many uploads in flight. Give the last one a moment to finish.";
    case "clip_too_large":
      return "That post is larger than the app can import.";
    case "not_connected":
      return `Reconnect ${name} in Connections, then try again.`;
    case "not_a_video":
      return "That post is not a video, so there is nothing to cross-post.";
    case "no_source_file":
      return platform === "tiktok"
        ? "TikTok did not provide a downloadable video for this post. Your selection is still here."
        : "Instagram did not hand over a file for that post. It usually means the post is too old to fetch.";
    case "import_timeout":
    case "download_timeout":
      return `${name} took too long to hand the file over. Try again.`;
    case "download_failed":
      return `The download from ${name} failed part way through. Try again.`;
    case "storage_unavailable":
      return "Storage is not reachable right now. Try again in a minute.";
    case "unauthorized":
      return "Sign in again, then try the import.";
    case "user_not_ready":
      return "Your account is still being set up. Try again in a moment.";
    case "upload_key_collision":
      return "That import collided with another one. Try again.";
    default:
      return "That original could not be prepared. Your selection is still here.";
  }
}
