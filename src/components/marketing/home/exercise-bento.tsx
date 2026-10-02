import Link from "next/link";
import { Camera, Mic, MessageCircle, Search, Users } from "lucide-react";
import styles from "./bento.module.css";
import WarmupCard from "./warmup-card";

const TOPICS = [
  "What’s a belief you’ve outgrown?",
  "Describe your perfect Sunday.",
  "What makes someone an expert?",
  "A small decision that changed a lot.",
];

const SMALL = [
  {
    href: "/training/explain-after-reading",
    title: "Explain after reading",
    text: "Read it, hide it, say it in your own words.",
    Icon: Search,
  },
  {
    href: "/freestyle-speech",
    title: "Freestyle speaking",
    text: "No prompt. Talk through what is on your mind.",
    Icon: Mic,
  },
  {
    href: "/training/conflict",
    title: "Difficult conversations",
    text: "Say the hard thing out loud first.",
    Icon: MessageCircle,
  },
  {
    href: "/training/dating",
    title: "Everyday conversations",
    text: "Small talk and short stories that sound like you.",
    Icon: Users,
  },
  {
    href: "/training/creator-camera-drills",
    title: "On-camera delivery",
    text: "Hooks and pitches for when the red light is on.",
    Icon: Camera,
  },
];

/**
 * Every Train exercise in one grid. The three most used get a card with a
 * small picture of what the exercise is; the rest are compact. Each card is
 * a link to that exercise's page.
 */
export default function ExerciseBento() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className={styles.intro}>
          <h2 className="type-h2">
            Speaking practice for the moment you need it
          </h2>
          <p className="type-description">
            Each exercise is a prompt and a timer. They are free, they run in
            your browser, and you can start one without an account.
          </p>
        </div>
        <ul className={styles.bento}>
          <li className={`${styles.card} ${styles.generator}`}>
            <Link href="/training/random-topic-generator">
              <div className={styles.reel} aria-hidden="true">
                <div>
                  {[...TOPICS, TOPICS[0]].map((topic, index) => (
                    <p key={index}>{topic}</p>
                  ))}
                </div>
              </div>
              <h3>Random topic generator</h3>
              <p>
                Pull a topic you did not choose and talk about it for a minute.
                The fastest way to practice thinking out loud.
              </p>
            </Link>
          </li>
          <li className={`${styles.card} ${styles.interview}`}>
            <Link href="/training/interview-prep">
              <div className={styles.bubbles} aria-hidden="true">
                <span>
                  “Tell me about a time you disagreed with your team.”
                </span>
                <span>Situation, action, result</span>
              </div>
              <h3>Interview answer practice</h3>
              <p>
                Common questions on a timer, so the first time you say your
                answer is not in the interview.
              </p>
            </Link>
          </li>
          <li className={`${styles.card} ${styles.aloud}`}>
            <Link href="/training/read-aloud">
              <div className={styles.wave} aria-hidden="true">
                {Array.from({ length: 22 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${28 + ((i * 37 + i * i * 3) % 60)}%`,
                      animationDelay: `${(i % 7) * -170}ms`,
                    }}
                  />
                ))}
              </div>
              <h3>Read aloud</h3>
              <p>Work on pace, pauses and emphasis with a passage.</p>
            </Link>
          </li>
          {SMALL.map(({ href, title, text, Icon }) => (
            <li key={href} className={`${styles.card} ${styles.small}`}>
              <Link href={href}>
                <Icon size={20} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            </li>
          ))}
          <WarmupCard />
        </ul>
      </div>
    </section>
  );
}
