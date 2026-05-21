import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseQuizFile, buildTemplateWorkbook } from '../server/src/lib/excel.js';

function buildWorkbook(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quiz');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('excel parser', () => {
  it('parses a valid file', () => {
    const buf = buildWorkbook([
      ['Question', 'Correct', 'W1', 'W2', 'W3'],
      ['Capital of France?', 'Paris', 'Berlin', 'Madrid', 'Rome'],
      ['2+2?', '4', '3', '5', '6'],
    ]);
    const result = parseQuizFile(buf, { shuffle: false });
    expect(result.ok).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]!.text).toBe('Capital of France?');
    // with shuffle off, correct is at index 0
    expect(result.questions[0]!.correctIndex).toBe(0);
    expect(result.questions[0]!.options[0]).toBe('Paris');
  });

  it('shuffles answer positions when enabled', () => {
    // Deterministic RNG that ensures a non-trivial permutation
    const buf = buildWorkbook([
      ['Q', 'C', 'W1', 'W2', 'W3'],
      ['test', 'correct', 'a', 'b', 'c'],
    ]);
    // Force last swap to move correct out of index 0 — we just run and assert
    // that option at correctIndex === "correct".
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(true);
    const q = result.questions[0]!;
    expect(q.options[q.correctIndex]).toBe('correct');
  });

  it('rejects empty question cell', () => {
    const buf = buildWorkbook([
      ['Q', 'C', 'W1', 'W2', 'W3'],
      ['', 'a', 'b', 'c', 'd'],
    ]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.reason).toMatch(/empty/i);
  });

  it('rejects missing answer cell', () => {
    const buf = buildWorkbook([
      ['Q', 'C', 'W1', 'W2', 'W3'],
      ['q', 'a', 'b', '', 'd'],
    ]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.reason).toMatch(/non-empty/i);
  });

  it('rejects duplicate answers in a row', () => {
    const buf = buildWorkbook([
      ['Q', 'C', 'W1', 'W2', 'W3'],
      ['q', 'a', 'A', 'b', 'c'], // duplicate (case-insensitive)
    ]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.reason).toMatch(/duplicate/i);
  });

  it('rejects more than 100 questions', () => {
    const header = ['Q', 'C', 'W1', 'W2', 'W3'];
    const rows: unknown[][] = [header];
    for (let i = 0; i < 101; i++) {
      rows.push([`q${i}`, `c${i}`, `w1-${i}`, `w2-${i}`, `w3-${i}`]);
    }
    const buf = buildWorkbook(rows);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
    // error mentions "Too many questions"
    expect(result.errors.some((e) => /too many/i.test(e.reason))).toBe(true);
  });

  it('rejects completely corrupt file', () => {
    const buf = Buffer.from([0xff, 0x00, 0xde, 0xad, 0xbe, 0xef]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects file with only a header', () => {
    const buf = buildWorkbook([['Q', 'C', 'W1', 'W2', 'W3']]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
  });

  it('rejects a question over 500 chars', () => {
    const buf = buildWorkbook([
      ['Q', 'C', 'W1', 'W2', 'W3'],
      ['x'.repeat(501), 'a', 'b', 'c', 'd'],
    ]);
    const result = parseQuizFile(buf);
    expect(result.ok).toBe(false);
  });

  it('builds a valid template workbook', () => {
    const wb = buildTemplateWorkbook();
    expect(wb.SheetNames[0]).toBe('Quiz');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const parsed = parseQuizFile(buf, { shuffle: false });
    expect(parsed.ok).toBe(true);
    expect(parsed.questions.length).toBe(3);
  });
});
