import type { Metadata } from "next";
import ContentCalendar from "@/components/calendar/content-calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Your scheduled content across the month.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Calendar
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Everything you&apos;ve scheduled, at a glance. Drag a post to another
        day to reschedule.
      </p>
      <ContentCalendar />
    </div>
  );
}
