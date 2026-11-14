import CreatorFrame from "./creator-frame";
import styles from "./studio-bento.module.css";

const looks = ["Clean", "Outline", "Pop", "Brand"];

/** A caption on the video in the Pop look, with the other looks to pick. */
export default function CaptionLooksVisual() {
  return (
    <div className={styles.captions}>
      <CreatorFrame shape="portrait">
        <p className={styles.captionLine}>
          Start with <b>what you have.</b>
        </p>
      </CreatorFrame>
      <ul className={styles.lookList}>
        {looks.map((look) => (
          <li key={look} data-current={look === "Pop"}>
            {look}
          </li>
        ))}
      </ul>
    </div>
  );
}
