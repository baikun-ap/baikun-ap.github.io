/**
 * Course content format.
 *
 * A course is a list of lessons; a lesson owns its words, grammar points and a
 * short dialogue. Every exercise in the app (pinyin, tones, listening,
 * speaking, sentence building, tests, flashcards) is generated from these
 * fields, so adding a book chapter means adding one Lesson object and nothing
 * else.
 *
 * Pinyin is written with tone marks ("nǐ hǎo"), one space between syllables of
 * different words and no space inside a word ("xuésheng"). Sentences are given
 * as hanzi tokens (word by word) so they can be cut into tiles.
 */

export interface Word {
  /** Simplified hanzi, e.g. "你好". */
  zh: string;
  /** Tone-marked pinyin, e.g. "nǐ hǎo". */
  py: string;
  /** Russian meaning. */
  ru: string;
  /** Part of speech or a short usage note, optional. */
  note?: string;
}

export interface Sentence {
  /** Hanzi tokens, word by word: ["我", "是", "学生", "。"]. */
  zh: string[];
  py: string;
  ru: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  /** The structure, written with slot names and Chinese anchors: "Подл. + 是 + Сущ." */
  formula: string;
  /** Two or three sentences of explanation in Russian. */
  explain: string;
  examples: Sentence[];
  /** A common mistake and its fix, optional. */
  pitfall?: { wrong: string; right: string; why: string };
}

export interface DialogueLine {
  who: string;
  zh: string;
  py: string;
  ru: string;
}

export interface Lesson {
  id: string;
  /** Lesson number inside its book. */
  n: number;
  /** Which book or course the lesson belongs to. */
  book: string;
  title: string;
  titleZh: string;
  titlePy: string;
  /** One line: what the learner can do after the lesson. */
  goal: string;
  words: Word[];
  grammar: GrammarPoint[];
  dialogue: DialogueLine[];
}

export interface Book {
  id: string;
  title: string;
  subtitle: string;
  lessons: Lesson[];
  /** Official audio for the printed book, linked rather than copied. */
  audio?: { label: string; url: string }[];
}
