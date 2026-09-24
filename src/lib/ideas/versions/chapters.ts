/**
 * Chapters in a long-form script: lines that start with `## `. No timestamps
 * in the text, because they are unknowable before recording; the real ones
 * come from the recorded transcript. YouTube drops a video's whole chapter
 * list if the first is not at 0:00 or there are fewer than three, so the
 * script always opens on a chapter and the editor warns under three.
 */

const CHAPTER = /^##\s+(.+?)\s*$/;
// "## 2:15 Title", "## (0:00) Title", "## 00:00 - Title"
const LEADING_TIME = /^\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*[-:.]?\s*/;
const NOTE = /^\s*\[(?:B-ROLL|ON SCREEN)\s*:[^\]]*\]\s*$/i;

export const SPOKEN_WORDS_PER_MINUTE = 150;
export const MIN_YOUTUBE_CHAPTERS = 3;

export interface Chapter {
  title: string;
  /** Spoken words in the chapter, notes and the heading excluded. */
  words: number;
}

function isChapter(line: string): boolean {
  return CHAPTER.test(line.trim());
}

function spokenWords(line: string): number {
  if (isChapter(line) || NOTE.test(line)) return 0;
  return line.split(/\s+/).filter(Boolean).length;
}

export function chaptersIn(script: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of script.split("\n")) {
    const match = CHAPTER.exec(line.trim());
    if (match) chapters.push({ title: match[1], words: 0 });
    else if (chapters.length)
      chapters[chapters.length - 1].words += spokenWords(line);
  }
  return chapters;
}

/** Words said aloud: chapter lines and [B-ROLL]/[ON SCREEN] notes don't count. */
export function spokenWordCount(script: string): number {
  return script.split("\n").reduce((sum, line) => sum + spokenWords(line), 0);
}

/** Minutes at a normal talking pace, rounded to the half minute. */
export function estimatedMinutes(script: string): number {
  return Math.max(
    0.5,
    Math.round((spokenWordCount(script) / SPOKEN_WORDS_PER_MINUTE) * 2) / 2,
  );
}

/**
 * The script as it should be stored: timestamps taken off chapter lines, and a
 * chapter line on top when the model forgot one, so YouTube's 0:00 rule holds.
 */
export function tidyLongScript(script: string, firstChapter: string): string {
  const lines = script.split("\n").map((line) => {
    const match = CHAPTER.exec(line.trim());
    if (!match) return line;
    const title = match[1].replace(LEADING_TIME, "").trim();
    return title ? `## ${title}` : "";
  });
  const firstText = lines.findIndex((line) => line.trim());
  if (firstText >= 0 && !isChapter(lines[firstText])) {
    lines.splice(firstText, 0, `## ${firstChapter}`, "");
  }
  return lines.join("\n").trim();
}
