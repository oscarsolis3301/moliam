import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  getSessionAudit,
  listRecentEvents,
  listSessionAudits,
  listSessionEvents,
} from '../db/repositories/audit.js';

export const auditRouter = Router();

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// One row per session, ordered newest first. Includes who hosted, how many
// players joined, peak roster, total questions, total answers, durationMs,
// and link-able sessionId for drilling in.
auditRouter.get('/sessions', (req: Request, res: Response) => {
  const parsed = PaginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid pagination' });
  }
  const sessions = listSessionAudits({ limit: parsed.data.limit, offset: parsed.data.offset });
  return res.json({ ok: true, sessions });
});

// Full timeline for one session: summary + per-player roll-up + raw event log.
auditRouter.get('/sessions/:id', (req: Request, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const detail = getSessionAudit(parsed.data);
  if (!detail) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.json({ ok: true, session: detail });
});

// Just the events for a session (no summary). Useful for incremental fetches.
auditRouter.get('/sessions/:id/events', (req: Request, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  const events = listSessionEvents(parsed.data);
  return res.json({ ok: true, events });
});

// Cross-session activity feed. Filterable by event type and actor.
const EventsQuerySchema = PaginationSchema.extend({
  event: z.string().min(1).max(100).optional(),
  actor: z.string().min(1).max(200).optional(),
});

auditRouter.get('/events', (req: Request, res: Response) => {
  const parsed = EventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid query' });
  }
  const events = listRecentEvents({
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    event: parsed.data.event,
    actor: parsed.data.actor,
  });
  return res.json({ ok: true, events });
});
