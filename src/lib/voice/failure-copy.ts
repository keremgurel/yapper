/** What to tell the creator when one video could not be heard. */
export function sampleFailureCopy(code: string): string {
  switch (code) {
    case "no_captions":
      return "YouTube has no captions for this video yet. Try again once they appear.";
    case "no_source_file":
      return "The platform would not hand over the video file, so it could not be transcribed.";
    case "empty_transcript":
      return "Nothing was heard in this video. Music-only clips cannot teach a voice.";
    case "too_long":
      return "This video is longer than 24 minutes. Pick a shorter one.";
    case "insufficient_credits":
      return "Not enough credits for this video.";
    case "not_entitled":
      return "Voice samples need an active plan.";
    case "rate_limited":
      return "Too many videos at once. Wait a moment and try again.";
    default:
      return "This video could not be transcribed. Try again in a moment.";
  }
}
