import PlatformIcon from "@/components/publish/platform-icon";
import styles from "./studio-bento.module.css";

const posts = [
  { channel: "instagram", name: "Instagram", when: "Tue 9:00" },
  { channel: "tiktok", name: "TikTok", when: "Tue 9:00" },
  { channel: "youtube", name: "YouTube Shorts", when: "Tue 12:00" },
] as const;

/** One video queued for three channels, each at its own time. */
export default function ChannelsVisual() {
  return (
    <ul className={styles.posts}>
      {posts.map((post) => (
        <li key={post.channel}>
          <span className={styles.postIcon}>
            <PlatformIcon
              platform={post.channel}
              className={styles.postGlyph}
            />
          </span>
          <span className={styles.postName}>{post.name}</span>
          <time>{post.when}</time>
        </li>
      ))}
    </ul>
  );
}
