import * as XLSX from 'xlsx';
import { MAX_QUESTIONS_PER_QUIZ, OPTIONS_PER_QUESTION } from '../../../shared/constants.js';
import type { QuestionDraft } from '../../../shared/schemas.js';
import { randomInt } from 'node:crypto';

export interface ParseError {
  row: number; // 1-indexed, matches the Excel row (header = row 1)
  reason: string;
}

export interface ParseResult {
  ok: boolean;
  questions: QuestionDraft[];
  errors: ParseError[];
}

/**
 * Parse an uploaded xlsx/csv buffer into question drafts.
 *
 * Expected layout: column A = question, B = correct, C/D/E = wrong answers.
 * Row 1 is a header and is skipped.
 *
 * On ANY validation error we return ok: false and a list of errors. The caller
 * should reject the whole file (no partial import).
 */
export function parseQuizFile(
  buffer: Buffer,
  opts: { shuffle?: boolean; rng?: () => number } = {},
): ParseResult {
  const shuffle = opts.shuffle ?? true;
  const rng = opts.rng ?? ((): number => randomInt(0, 1_000_000) / 1_000_000);

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { ok: false, questions: [], errors: [{ row: 0, reason: 'Could not read file. Is it a valid .xlsx or .csv?' }] };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { ok: false, questions: [], errors: [{ row: 0, reason: 'Workbook has no sheets.' }] };
  }
  const sheet = wb.Sheets[sheetName]!;
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  if (rows.length < 2) {
    return { ok: false, questions: [], errors: [{ row: 0, reason: 'File has no data rows (header is required on row 1).' }] };
  }

  const errors: ParseError[] = [];
  const questions: QuestionDraft[] = [];

  // skip row 1 (header)
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_QUESTIONS_PER_QUIZ) {
    errors.push({
      row: MAX_QUESTIONS_PER_QUIZ + 2,
      reason: `Too many questions. Max ${MAX_QUESTIONS_PER_QUIZ}, got ${dataRows.length}.`,
    });
  }

  for (let i = 0; i < dataRows.length; i++) {
    const excelRow = i + 2; // row 1 is header
    const r = dataRows[i] ?? [];

    const cellStr = (v: unknown): string =>
      typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();

    const question = cellStr(r[0]);
    const correct = cellStr(r[1]);
    const wrong1 = cellStr(r[2]);
    const wrong2 = cellStr(r[3]);
    const wrong3 = cellStr(r[4]);

    if (!question) {
      errors.push({ row: excelRow, reason: 'Question text (column A) is empty.' });
      continue;
    }
    const answers = [correct, wrong1, wrong2, wrong3];
    if (answers.some((a) => !a)) {
      errors.push({
        row: excelRow,
        reason: 'All four answer cells (columns B–E) must be non-empty.',
      });
      continue;
    }
    if (answers.length !== OPTIONS_PER_QUESTION) {
      errors.push({ row: excelRow, reason: `Expected ${OPTIONS_PER_QUESTION} answer cells.` });
      continue;
    }
    // Duplicate detection, case-insensitive, trimmed already.
    const lower = answers.map((a) => a.toLowerCase());
    const uniq = new Set(lower);
    if (uniq.size !== OPTIONS_PER_QUESTION) {
      errors.push({ row: excelRow, reason: 'Duplicate answer values in the same row.' });
      continue;
    }
    if (question.length > 500) {
      errors.push({ row: excelRow, reason: 'Question text exceeds 500 characters.' });
      continue;
    }
    if (answers.some((a) => a.length > 200)) {
      errors.push({ row: excelRow, reason: 'An answer exceeds 200 characters.' });
      continue;
    }

    // Shuffle so column B being always-correct doesn't leak.
    const options = [...answers];
    let correctIndex = 0;
    if (shuffle) {
      const order = [0, 1, 2, 3];
      for (let j = order.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1));
        const tmp = order[j]!; order[j] = order[k]!; order[k] = tmp;
      }
      const reordered = order.map((ix) => answers[ix]!);
      correctIndex = order.indexOf(0);
      options.splice(0, options.length, ...reordered);
    }

    questions.push({ text: question, options, correctIndex });
  }

  if (errors.length > 0) {
    return { ok: false, questions: [], errors };
  }
  if (questions.length === 0) {
    return { ok: false, questions: [], errors: [{ row: 0, reason: 'No valid questions found.' }] };
  }
  return { ok: true, questions, errors: [] };
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = ['Question', 'Correct answer', 'Wrong answer 1', 'Wrong answer 2', 'Wrong answer 3'];
  const examples = [
    ['What year did the first moon landing occur?', '1969', '1965', '1972', '1959'],
    ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
    ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...examples]);
  ws['!cols'] = [
    { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Quiz');
  return wb;
}
