import PlatformIcon from "@/components/publish/platform-icon";
import styles from "./studio-bento.module.css";

const channels = ["instagram", "tiktok", "youtube"] as const;
const names = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };

/** One video going to three channels, each with its own caption. */
export default function ChannelsVisual() {
  return (
    <ul className={styles.channels}>
      {channels.map((channel) => (
        <li key={channel}>
          <PlatformIcon platform={channel} className={styles.channelIcon} />
          <span>{names[channel]}</span>
          <em>Scheduled</em>
        </li>
      ))}
    </ul>
  );
}
