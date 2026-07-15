import { redirect } from "next/navigation";

// The calendar folded into the Poster hub. Keep the old path working for
// bookmarks and in-flight links by sending it to the calendar tab there.
export default function Page() {
  redirect("/studio/poster?tab=calendar");
}
