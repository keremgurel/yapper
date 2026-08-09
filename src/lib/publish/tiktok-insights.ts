/** What TikTok will tell us about a connected creator. */
export interface TikTokCreatorInsights {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  profileUrl: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videos: number | null;
  /** Fields the connection is not scoped for. Reported rather than shown as
   * zero: "0 followers" is a lie, "not connected for this" is the truth and
   * tells the creator what to do about it. */
  missing: string[];
}

/** The account fields, which need `user.info.profile`. */
const PROFILE_FIELDS = [
  "open_id",
  "display_name",
  "avatar_url",
  "bio_description",
  "is_verified",
  "profile_deep_link",
  "username",
] as const;

/** The counts, which need `user.info.stats`. */
const STAT_FIELDS = [
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
] as const;

interface UserInfoResponse {
  data?: {
    user?: Record<string, unknown>;
  };
  error?: { code?: string; message?: string };
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Reads one response into insights, and says what was not in it.
 *
 * Exported so the mapping can be tested without the network, and because the
 * partial case is the normal one: an app approved for the Display API but not
 * asked for `user.info.stats` gets a profile and no counts, and the panel has
 * to be able to say so.
 */
export function mapTikTokInsights(
  json: UserInfoResponse,
): TikTokCreatorInsights {
  const user = json.data?.user ?? {};
  const username = str(user.username);
  const insights: TikTokCreatorInsights = {
    username,
    displayName: str(user.display_name),
    avatarUrl: str(user.avatar_url),
    bio: str(user.bio_description),
    isVerified: user.is_verified === true,
    profileUrl:
      str(user.profile_deep_link) ??
      (username ? `https://www.tiktok.com/@${username}` : null),
    followers: num(user.follower_count),
    following: num(user.following_count),
    likes: num(user.likes_count),
    videos: num(user.video_count),
    missing: [],
  };

  if (insights.followers === null && insights.videos === null) {
    insights.missing.push("user.info.stats");
  }
  if (!insights.username && !insights.bio) {
    insights.missing.push("user.info.profile");
  }
  return insights;
}

/**
 * The connected creator's own profile and counts.
 *
 * Everything in one call, because TikTok's user info endpoint takes the fields
 * it is scoped for and returns the rest as absent rather than failing. A
 * connection made before the insight scopes existed therefore degrades to a
 * profile with no counts instead of an error.
 */
export async function fetchTikTokInsights(
  accessToken: string,
): Promise<TikTokCreatorInsights> {
  const fields = [...PROFILE_FIELDS, ...STAT_FIELDS].join(",");
  const res = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`tiktok_insights_${res.status}`);
  return mapTikTokInsights((await res.json()) as UserInfoResponse);
}
