import { redirect } from "next/navigation";

/** The Content Library merged into Ideas. Old links keep working. */
export default function Page() {
  redirect("/studio/ideas");
}
