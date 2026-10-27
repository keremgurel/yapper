import type { Metadata } from "next";
import ContentCalendar from "@/components/calendar/content-calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description: "See, move and cancel everything scheduled to post.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="w-full">
      <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">
        Calendar
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Posts scheduled to go out, planned dates, and what’s already live.
      </p>
      <ContentCalendar />
    </div>
  );
}
