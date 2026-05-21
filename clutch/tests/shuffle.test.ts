import { describe, it, expect } from 'vitest';
import { shuffleQuiz, shuffleInPlace } from '../server/src/game/shuffle.js';
import type { QuizWithQuestions } from '../server/src/db/repositories/quizzes.js';

function makeQuiz(): QuizWithQuestions {
  return {
    id: 'q1',
    name: 'Test',
    createdAt: 0,
    questions: [
      { id: 'a', position: 0, text: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
      { id: 'b', position: 1, text: 'Q2', options: ['W', 'X', 'Y', 'Z'], correctIndex: 2 },
      { id: 'c', position: 2, text: 'Q3', options: ['1', '2', '3', '4'], correctIndex: 3 },
    ],
  };
}

describe('shuffleInPlace', () => {
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const before = [...arr];
    shuffleInPlace(arr);
    expect(arr.sort()).toEqual(before.sort());
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffleInPlace([])).toEqual([]);
    expect(shuffleInPlace([42])).toEqual([42]);
  });
});

describe('shuffleQuiz', () => {
  it('preserves the correct answer text after option shuffle', () => {
    const src = makeQuiz();
    for (let trial = 0; trial < 50; trial++) {
      const shuffled = shuffleQuiz(src);
      for (let qi = 0; qi < src.questions.length; qi++) {
        const orig = src.questions[qi]!;
        // The shuffled quiz's questions may be in a different order, so find
        // the matching question by id.
        const match = shuffled.questions.find((q) => q.id === orig.id)!;
        expect(match.options[match.correctIndex]).toBe(orig.options[orig.correctIndex]);
      }
    }
  });

  it('preserves the option set per question', () => {
    const src = makeQuiz();
    const shuffled = shuffleQuiz(src);
    for (const q of shuffled.questions) {
      const orig = src.questions.find((o) => o.id === q.id)!;
      expect([...q.options].sort()).toEqual([...orig.options].sort());
    }
  });

  it('preserves the question set', () => {
    const src = makeQuiz();
    const shuffled = shuffleQuiz(src);
    const srcIds = src.questions.map((q) => q.id).sort();
    const newIds = shuffled.questions.map((q) => q.id).sort();
    expect(newIds).toEqual(srcIds);
  });

  it('does not mutate the source quiz', () => {
    const src = makeQuiz();
    const snapshot = JSON.parse(JSON.stringify(src));
    shuffleQuiz(src);
    expect(src).toEqual(snapshot);
  });
});
