import BentoCell from "./bento-cell";
import CaptionLooksVisual from "./caption-looks-visual";
import ChannelsVisual from "./channels-visual";
import IdeaRowsVisual from "./idea-rows-visual";
import PrompterVisual from "./prompter-visual";
import TakeCutVisual from "./take-cut-visual";
import styles from "./studio-bento.module.css";

/**
 * The section under the homepage hero: what Studio does, as five cells that
 * each show a piece of the product and link to its feature page. It sits on
 * a stone band so the hero's demo and the first feature section are not two
 * product screens on the same backdrop back to back.
 */
export default function StudioBento() {
  return (
    <section className={styles.band} aria-labelledby="studio-bento-title">
      <div className="marketing-container">
        <header className={styles.intro}>
          <p className="type-label">One studio</p>
          <h2 id="studio-bento-title" className="type-h2">
            From a raw idea to a posted video.
          </h2>
          <p className="type-description">
            Yapper Studio is a video editor, teleprompter and content planner
            for talking-head videos, on Mac and the web.
          </p>
        </header>
        <div className={styles.grid}>
          <BentoCell
            wide
            href="/features/transcript-video-editor"
            title="One-click video editing"
            body="Record once and talk through your mistakes. One click cuts the retakes, pauses and silence, and you fix anything left by deleting words in the transcript."
            linkLabel="How one-click editing works"
          >
            <TakeCutVisual />
          </BentoCell>
          <BentoCell
            href="/features/automatic-captions"
            title="Automatic captions"
            body="Captions timed to each word, in four looks you can restyle."
            linkLabel="See automatic captions"
          >
            <CaptionLooksVisual />
          </BentoCell>
          <BentoCell
            href="/features/teleprompter-recorder"
            title="Teleprompter recorder"
            body="Read your script off the screen while you record, at your pace."
            linkLabel="See the teleprompter"
          >
            <PrompterVisual />
          </BentoCell>
          <BentoCell
            href="/features/idea-capture"
            title="Ideas that sound like you"
            body="Capture a thought and get a script written in your own voice."
            linkLabel="See idea capture"
          >
            <IdeaRowsVisual />
          </BentoCell>
          <BentoCell
            href="/features/social-publishing"
            title="Post to every channel"
            body="Schedule one video to Instagram, TikTok and YouTube together."
            linkLabel="See social publishing"
          >
            <ChannelsVisual />
          </BentoCell>
        </div>
      </div>
    </section>
  );
}
