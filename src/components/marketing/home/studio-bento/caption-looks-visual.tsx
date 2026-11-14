import styles from "./studio-bento.module.css";

const looks = [
  { name: "Clean", className: styles.lookClean },
  { name: "Outline", className: styles.lookOutline },
  { name: "Pop", className: styles.lookPop },
  { name: "Brand", className: styles.lookBrand },
];

/** The four caption looks, drawn the way the editor's picker shows them. */
export default function CaptionLooksVisual() {
  return (
    <div className={styles.looks}>
      {looks.map((look) => (
        <div key={look.name} className={styles.look}>
          <span className={look.className}>Aa</span>
          <small>{look.name}</small>
        </div>
      ))}
    </div>
  );
}
