import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { parseQuizFile, buildTemplateWorkbook } from '../lib/excel.js';
import {
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  getQuiz,
  listQuizzes,
  updateQuiz,
} from '../db/repositories/quizzes.js';
import { QuizDraftSchema } from '../../../shared/schemas.js';
import { MAX_UPLOAD_BYTES } from '../../../shared/constants.js';
import { logger } from '../lib/logger.js';
import { AUDIT_EVENTS, recordEvent } from '../db/repositories/audit.js';
import { extractActorFromRequest } from '../lib/actor.js';

export const quizzesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

quizzesRouter.get('/template', (_req: Request, res: Response) => {
  const wb = buildTemplateWorkbook();
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="clutch-template.xlsx"');
  res.send(buf);
});

quizzesRouter.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ ok: false, errors: [{ row: 0, reason: 'No file uploaded.' }] });
    }
    const ext = (req.file.originalname.split('.').pop() ?? '').toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      return res
        .status(400)
        .json({ ok: false, errors: [{ row: 0, reason: 'File must be .xlsx, .xls, or .csv' }] });
    }

    const result = parseQuizFile(req.file.buffer);
    if (!result.ok) {
      logger.info({ filename: req.file.originalname, errors: result.errors }, 'upload rejected');
      return res.status(400).json(result);
    }

    const suggestedName = req.file.originalname.replace(/\.[^.]+$/, '') || 'Untitled quiz';
    return res.json({
      ok: true,
      suggestedName,
      questions: result.questions,
    });
  },
);

const SaveBody = QuizDraftSchema;

quizzesRouter.post('/', (req: Request, res: Response) => {
  const parsed = SaveBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  try {
    const id = createQuiz(parsed.data);
    const actor = extractActorFromRequest(req);
    logger.info({ quizId: id, name: parsed.data.name, count: parsed.data.questions.length, actor }, 'quiz saved');
    recordEvent({
      event: AUDIT_EVENTS.QuizCreated,
      quizId: id,
      actor,
      details: { name: parsed.data.name, questionCount: parsed.data.questions.length },
    });
    return res.json({ ok: true, quizId: id });
  } catch (err) {
    logger.error({ err }, 'createQuiz failed');
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

quizzesRouter.get('/', (_req: Request, res: Response) => {
  return res.json({ ok: true, quizzes: listQuizzes() });
});

quizzesRouter.get('/:id', (req: Request, res: Response) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const quiz = getQuiz(idParsed.data);
  if (!quiz) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.json({ ok: true, quiz });
});

quizzesRouter.put('/:id', (req: Request, res: Response) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const body = SaveBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ ok: false, error: body.error.flatten() });
  }
  try {
    const ok = updateQuiz(idParsed.data, body.data);
    if (!ok) return res.status(404).json({ ok: false, error: 'Not found' });
    const actor = extractActorFromRequest(req);
    logger.info(
      { quizId: idParsed.data, name: body.data.name, count: body.data.questions.length, actor },
      'quiz updated',
    );
    recordEvent({
      event: AUDIT_EVENTS.QuizUpdated,
      quizId: idParsed.data,
      actor,
      details: { name: body.data.name, questionCount: body.data.questions.length },
    });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'updateQuiz failed');
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

quizzesRouter.post('/:id/duplicate', (req: Request, res: Response) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const nameParsed = z
    .object({ name: z.string().trim().min(1).max(100).optional() })
    .safeParse(req.body ?? {});
  const newName = nameParsed.success ? nameParsed.data.name : undefined;
  try {
    const newId = duplicateQuiz(idParsed.data, newName);
    if (!newId) return res.status(404).json({ ok: false, error: 'Not found' });
    recordEvent({
      event: AUDIT_EVENTS.QuizDuplicated,
      quizId: newId,
      actor: extractActorFromRequest(req),
      details: { sourceQuizId: idParsed.data, newName: newName ?? null },
    });
    return res.json({ ok: true, quizId: newId });
  } catch (err) {
    logger.error({ err }, 'duplicateQuiz failed');
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

quizzesRouter.delete('/:id', (req: Request, res: Response) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const ok = deleteQuiz(idParsed.data);
  if (ok) {
    recordEvent({
      event: AUDIT_EVENTS.QuizDeleted,
      quizId: idParsed.data,
      actor: extractActorFromRequest(req),
    });
  }
  return res.json({ ok });
});
