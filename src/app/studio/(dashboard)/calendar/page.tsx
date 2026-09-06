import type { Metadata } from "next";
import ContentCalendar from "@/components/calendar/content-calendar";
import PublishingSchedules from "@/components/calendar/publishing-schedules";

export const metadata: Metadata = {
  title: "Calendar",
  description: "See and plan everything you have scheduled to post.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="w-full">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Calendar
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Plan your content dates and see what’s coming next.
      </p>
      <PublishingSchedules />
      <ContentCalendar />
    </div>
  );
}
