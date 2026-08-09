import type { AddVideoError } from "@/hooks/use-add-video";

export function uploadErrorText(error: AddVideoError): string {
  if (error === "not_video") return "Choose a video file.";
  if (error === "storage_full") return "Storage is full.";
  if (error === "locked") return "Uploading needs an active plan.";
  return "Upload failed. Please try again.";
}
