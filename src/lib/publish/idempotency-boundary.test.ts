import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = ["youtube", "instagram", "tiktok"] as const;

describe("irreversible publish route boundary", () => {
  it.each(routes)(
    "%s replays an existing attempt before body, token, media, or provider work",
    (platform) => {
      const source = readFileSync(
        `src/app/api/publish/${platform}/route.ts`,
        "utf8",
      );
      const handler = source.indexOf("export async function POST");
      const replay = source.indexOf("await findPublishJobClaim", handler);
      const bodyRead = source.indexOf("PublishRequest(req)", replay);

      expect(replay).toBeGreaterThan(handler);
      expect(bodyRead).toBeGreaterThan(replay);
      expect(replay).toBeLessThan(
        source.indexOf("await resolveOwnedMediaKey", handler),
      );
      expect(replay).toBeLessThan(
        source.indexOf("await getFreshAccessToken", handler),
      );
      expect(replay).toBeLessThan(
        source.indexOf("await claimPublishJob", handler),
      );
    },
  );
});
