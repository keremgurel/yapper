import type { AddVideoError } from "@/hooks/use-add-video";

export function uploadErrorText(error: AddVideoError): string {
  if (error === "not_video") return "Choose a video file.";
  if (error === "storage_full") return "Storage is full.";
  if (error === "locked") return "Uploading needs an active plan.";
  if (error === "too_large") return "That video is over the 4 GB upload limit.";
  if (error === "network")
    return "The upload lost its connection. Your file is safe—try again.";
  return "The upload could not finish. Try again; no blank video was created.";
}
