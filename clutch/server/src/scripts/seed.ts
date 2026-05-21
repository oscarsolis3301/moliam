import { config } from '../lib/config.js';
import { initDb, closeDb } from '../db/connection.js';
import { createQuiz, listQuizzes } from '../db/repositories/quizzes.js';

initDb(config.dbPath);

const existing = listQuizzes();
if (existing.some((q) => q.name === 'Welcome to Clutch')) {
  console.log('Seed quiz already present — skipping.');
  closeDb();
  process.exit(0);
}

const id = createQuiz({
  name: 'Welcome to Clutch',
  questions: [
    {
      text: 'In what year did the first moon landing happen?',
      options: ['1965', '1969', '1972', '1959'],
      correctIndex: 1,
    },
    {
      text: 'Which of these is a JavaScript runtime?',
      options: ['Rails', 'Django', 'Node.js', 'Laravel'],
      correctIndex: 2,
    },
    {
      text: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mercury', 'Jupiter', 'Mars'],
      correctIndex: 3,
    },
    {
      text: 'What is the capital of Australia?',
      options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'],
      correctIndex: 0,
    },
    {
      text: 'Which ocean is the largest by area?',
      options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'],
      correctIndex: 2,
    },
  ],
});

console.log(`Seeded quiz: ${id}`);
closeDb();
