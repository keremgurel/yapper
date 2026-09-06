import type { ScheduleSummary } from "./schedule-types";
import type { PublishPlatform } from "@/lib/db/schema";

export interface ScheduleRequest {
  requestKey: string;
  scheduledFor: string;
  timezone: string;
  targets: {
    platform: PublishPlatform;
    expectedAccountId: string;
    input: Record<string, unknown>;
  }[];
}

async function result<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? "schedule_failed");
  }
  return response.json() as Promise<T>;
}

export async function fetchSchedules() {
  return result<{ enabled: boolean; schedules: ScheduleSummary[] }>(
    await fetch("/api/publish/schedules", { cache: "no-store" }),
  );
}

export async function schedulePosts(input: ScheduleRequest) {
  return result<{ schedules: ScheduleSummary[] }>(
    await fetch("/api/publish/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function changeSchedule(
  id: string,
  action: "cancel" | "reschedule" | "retry",
  scheduledFor?: string,
) {
  return result<{ schedule: ScheduleSummary }>(
    await fetch(`/api/publish/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, scheduledFor }),
    }),
  );
}

export function scheduleErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    scheduling_unavailable:
      "Scheduled publishing isn’t available on this server yet.",
    invalid_body:
      "Choose a time at least a minute ahead and within the next 90 days. Check that every destination has valid copy.",
    destination_not_connected:
      "Connect every selected destination before scheduling.",
    destination_account_changed:
      "The connected account has changed. Cancel this schedule and create one for the new account.",
    schedule_already_started:
      "Sending has already started. Refresh to see the result.",
    schedule_not_retryable:
      "This post can’t be retried from its current state. Refresh to see the result.",
    publish_state_pending:
      "The platform may have accepted this post. Check the destination before taking further action.",
    publish_in_progress:
      "The platform is still processing this attempt. Check the destination before taking further action.",
    thumbnail_unavailable:
      "The cover is no longer available. Prepare a new cover and schedule again.",
    media_unavailable:
      "The saved video is no longer available. Open it in your Library to check the source.",
    media_not_found:
      "The saved video couldn’t be found. Check its source in your Library.",
    content_item_unavailable: "The Library item is no longer available.",
    schedule_request_changed:
      "An earlier version of this schedule was already saved. Check Calendar before creating another.",
    duplicate_destination:
      "The same video was selected more than once for a destination. Keep one copy and try again.",
    publish_failed:
      "Sending failed. Choose a new time to retry, or cancel this post.",
    publish_attempt_failed:
      "The previous sending attempt failed. Choose a new time to retry.",
    upload_failed: "The video could not be sent. Choose a new time to retry.",
    unauthorized: "Sign in again to manage your scheduled posts.",
  };
  return (
    messages[code] ??
    "We couldn’t confirm the change. Refresh Calendar to check the saved result before trying again."
  );
}

export function localScheduleInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
