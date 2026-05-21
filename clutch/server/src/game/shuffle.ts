import type { QuizWithQuestions } from '../db/repositories/quizzes.js';

// In-place Fisher-Yates. Standalone so it's testable independently of the
// quiz-specific cloning logic below.
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Returns a deep-cloned copy of the quiz with question order randomized AND
 * each question's options re-ordered. The `correctIndex` is remapped to track
 * the option's new position so scoring remains correct.
 *
 * The on-disk quiz is never mutated — callers (engine.createSession) hold the
 * shuffled copy on the LiveSession so each play is fresh while the canonical
 * quiz stays the canonical quiz.
 */
export function shuffleQuiz(quiz: QuizWithQuestions): QuizWithQuestions {
  const shuffledQuestions = quiz.questions.map((q) => {
    // Build a permutation [0..N-1] and shuffle it. Using indices (vs. shuffling
    // the options array directly) lets us locate the original correctIndex
    // inside the new arrangement without a string-based lookup that would
    // misbehave if two options happened to have identical text.
    const indices = q.options.map((_, i) => i);
    shuffleInPlace(indices);
    const newOptions = indices.map((i) => q.options[i]!);
    const newCorrectIndex = indices.indexOf(q.correctIndex);
    return {
      ...q,
      options: newOptions,
      correctIndex: newCorrectIndex,
    };
  });
  shuffleInPlace(shuffledQuestions);
  return {
    ...quiz,
    questions: shuffledQuestions,
  };
}
