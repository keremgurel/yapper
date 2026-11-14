import styles from "./studio-bento.module.css";

const ideas = [
  { title: "What my app audit caught", status: "Captured" },
  { title: "How I use AI at work", status: "Drafting" },
  { title: "One month after surgery", status: "Posted" },
];

/** Three ideas at three stages, as rows from the Ideas list. */
export default function IdeaRowsVisual() {
  return (
    <ul className={styles.ideas}>
      {ideas.map((idea) => (
        <li key={idea.title}>
          <span>{idea.title}</span>
          <em data-status={idea.status}>{idea.status}</em>
        </li>
      ))}
    </ul>
  );
}
