import HomeJsonLd from "./home-json-ld";
import HomeClient from "./home-client";
import { getRandomTopic } from "@/lib/practice-helpers";

export default function Page() {
  const initialTopic = getRandomTopic(null, "All", "All");

  return (
    <>
      <HomeJsonLd />
      <HomeClient initialTopic={initialTopic} />
    </>
  );
}
