import type { QuestionDraft, QuizSummary } from '@shared/schemas.js';
import { BASE } from './router.js';

// REST calls share the SPA's prefix — `/clutch-app/api` behind the FastAPI
// harness, plain `/api` when running standalone.
const API = `${BASE}/api`;

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'Bad JSON' }));
  if (!res.ok || json?.ok === false) {
    const msg =
      (json && typeof json.error === 'string' && json.error) ||
      json?.errors?.[0]?.reason ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export async function listQuizzes(): Promise<QuizSummary[]> {
  const r = await jfetch<{ ok: true; quizzes: QuizSummary[] }>(`${API}/quizzes`);
  return r.quizzes;
}

export async function deleteQuiz(id: string): Promise<void> {
  await jfetch(`${API}/quizzes/${id}`, { method: 'DELETE' });
}

export interface UploadReviewResponse {
  ok: true;
  suggestedName: string;
  questions: QuestionDraft[];
}

export interface UploadErrorResponse {
  ok: false;
  errors: Array<{ row: number; reason: string }>;
}

export async function uploadQuiz(
  file: File,
): Promise<UploadReviewResponse | UploadErrorResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/quizzes/upload`, { method: 'POST', body: fd });
  const json = await res.json();
  return json;
}

export async function saveQuiz(draft: {
  name: string;
  questions: QuestionDraft[];
}): Promise<string> {
  const r = await jfetch<{ ok: true; quizId: string }>(`${API}/quizzes`, {
    method: 'POST',
    body: JSON.stringify(draft),
  });
  return r.quizId;
}

export interface QuizDetail {
  id: string;
  name: string;
  createdAt: number;
  questions: Array<{
    id: string;
    position: number;
    text: string;
    options: string[];
    correctIndex: number;
  }>;
}

export async function getQuiz(id: string): Promise<QuizDetail> {
  const r = await jfetch<{ ok: true; quiz: QuizDetail }>(`${API}/quizzes/${id}`);
  return r.quiz;
}

export async function updateQuiz(
  id: string,
  draft: { name: string; questions: QuestionDraft[] },
): Promise<void> {
  await jfetch(`${API}/quizzes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  });
}

export async function duplicateQuiz(id: string, name?: string): Promise<string> {
  const r = await jfetch<{ ok: true; quizId: string }>(`${API}/quizzes/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });
  return r.quizId;
}

export async function lookupSession(
  code: string,
): Promise<{ sessionId: string; state: string } | null> {
  try {
    const r = await jfetch<{ ok: true; sessionId: string; state: string }>(
      `${API}/sessions/${encodeURIComponent(code)}`,
    );
    return { sessionId: r.sessionId, state: r.state };
  } catch {
    return null;
  }
}

// Exported so other modules (host view) can compose URLs consistently.
export const CLUTCH_API_BASE = API;

// ---------- host-mode PIN gate ----------

export interface HostAuthOk {
  ok: true;
  token: string;
  expiresInMs: number;
}
export interface HostAuthErr {
  ok: false;
  reason: string;
  retryAfterMs?: number;
  remainingAttempts?: number;
}
export type HostAuthResult = HostAuthOk | HostAuthErr;

export async function verifyHostPin(pin: string): Promise<HostAuthResult> {
  const res = await fetch(`${API}/host-auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const json = (await res.json().catch(() => ({ ok: false, reason: 'Bad response' }))) as HostAuthResult;
  return json;
}

export async function checkHostToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/host-auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

export interface HostAuthState {
  ok: true;
  locked: boolean;
  lockedFor: number;
  remainingAttempts: number;
  maxAttempts: number;
}

export async function getHostAuthState(): Promise<HostAuthState | null> {
  try {
    const res = await fetch(`${API}/host-auth/state`);
    if (!res.ok) return null;
    return (await res.json()) as HostAuthState;
  } catch {
    return null;
  }
}

// ---------- audit ----------

export interface AuditSessionSummary {
  sessionId: string;
  code: string;
  quizId: string;
  quizName: string | null;
  state: string;
  hostActor: string | null;
  createdAt: number;
  firstStartedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  peakPlayerCount: number;
  joinedPlayerCount: number;
  questionCount: number;
  answerCount: number;
  finalRanks: number;
}

export interface AuditEvent {
  id: number;
  ts: number;
  event: string;
  sessionId: string | null;
  quizId: string | null;
  actor: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditPlayer {
  name: string;
  joinedAt: number;
  answers: number;
  correct: number;
  finalScore: number | null;
  finalRank: number | null;
}

export interface AuditQuizQuestion {
  position: number;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface AuditQuizSnapshot {
  id: string;
  name: string;
  questions: AuditQuizQuestion[];
}

export interface AuditSessionDetail extends AuditSessionSummary {
  events: AuditEvent[];
  players: AuditPlayer[];
  quiz: AuditQuizSnapshot | null;
}

export async function listAuditSessions(opts: { limit?: number; offset?: number } = {}): Promise<AuditSessionSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const r = await jfetch<{ ok: true; sessions: AuditSessionSummary[] }>(
    `${API}/audit/sessions${qs ? `?${qs}` : ''}`,
  );
  return r.sessions;
}

export async function getAuditSession(sessionId: string): Promise<AuditSessionDetail> {
  const r = await jfetch<{ ok: true; session: AuditSessionDetail }>(
    `${API}/audit/sessions/${encodeURIComponent(sessionId)}`,
  );
  return r.session;
}

export async function listAuditEvents(opts: { limit?: number; offset?: number; event?: string; actor?: string } = {}): Promise<AuditEvent[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  if (opts.event) params.set('event', opts.event);
  if (opts.actor) params.set('actor', opts.actor);
  const qs = params.toString();
  const r = await jfetch<{ ok: true; events: AuditEvent[] }>(
    `${API}/audit/events${qs ? `?${qs}` : ''}`,
  );
  return r.events;
}
