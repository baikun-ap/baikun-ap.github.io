/**
 * Microeconomics: the four assignments of the course, 20 questions each.
 * 50 of these 80 questions come up on the exam, so the exam drill draws 50.
 *
 * The question text is filled in from the assignment sheets. A question with
 * `options` is multiple choice (`answer` is the index of the right option);
 * one without is an open question (`answer` is the model answer, shown on reveal).
 */

import { A1 } from './micro-a1';

export interface MicroQ {
  id: string;
  q: string;
  options?: string[];
  answer: number | string;
  /** Why the answer is right: a line of reasoning, a formula, a graph to picture. */
  explain?: string;
  /** Russian gloss of the question, for a quick check of the meaning. */
  ru?: string;
}

export interface Assignment {
  n: number;
  title: string;
  /** Chapters of the textbook the assignment covers. */
  chapters?: string;
  due?: string;
  questions: MicroQ[];
}

export const EXAM_SIZE = 50;
export const PER_ASSIGNMENT = 20;

export const ASSIGNMENTS: Assignment[] = [
  { n: 1, title: 'Assignment One', chapters: 'Ch. 1 · Ten Principles of Economics', questions: A1 },
  { n: 2, title: 'Assignment Two', due: '2026-10-31', questions: [] },
  { n: 3, title: 'Assignment Three', questions: [] },
  { n: 4, title: 'Assignment Four', questions: [] },
];

export const ALL_MICRO = (): MicroQ[] => ASSIGNMENTS.flatMap((a) => a.questions);
