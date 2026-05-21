import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  getResults,
  getSessionByCode,
  getSessionById,
} from '../db/repositories/sessions.js';
import { SessionCodeSchema } from '../../../shared/schemas.js';

export const sessionsRouter = Router();

// Lookup by raw uuid. Placed before /:code so valid uuids don't fall through.
sessionsRouter.get('/by-id/:id', (req: Request, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const row = getSessionById(parsed.data);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.json({
    ok: true,
    sessionId: row.id,
    code: row.code,
    state: row.state,
    quizId: row.quizId,
  });
});

sessionsRouter.get('/:code', (req: Request, res: Response) => {
  const raw = req.params.code;
  const codeStr = typeof raw === 'string' ? raw.toUpperCase() : '';
  const parsed = SessionCodeSchema.safeParse(codeStr);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid code' });
  }
  const row = getSessionByCode(parsed.data);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.json({
    ok: true,
    sessionId: row.id,
    state: row.state,
  });
});

sessionsRouter.get('/:id/results', (req: Request, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const row = getSessionById(parsed.data);
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' });

  const results = getResults(parsed.data);
  return res.json({
    ok: true,
    sessionId: row.id,
    state: row.state,
    results,
  });
});
