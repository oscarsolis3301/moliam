import type { Router } from '../lib/router.js';
import {
  getAuditSession,
  listAuditEvents,
  listAuditSessions,
  type AuditEvent,
  type AuditPlayer,
  type AuditSessionDetail,
  type AuditSessionSummary,
} from '../lib/api.js';
import { hasValidStoredAuth } from '../lib/host-auth.js';
import { openPinGate } from '../components/pinGate.js';
import { mountWordmark } from '../components/wordmark.js';
import { toast } from '../components/modal.js';

// ----- Public entry points -----

export async function renderAuditDashboard(app: HTMLElement, router: Router): Promise<void> {
  if (!(await ensureHostAuth(router))) return;
  app.innerHTML = loadingShell('Loading audit data');
  try {
    const [sessions, recentEvents] = await Promise.all([
      listAuditSessions({ limit: 200 }),
      listAuditEvents({ limit: 200 }),
    ]);
    paintDashboard(app, router, sessions, recentEvents);
  } catch (err) {
    paintError(app, router, (err as Error).message);
  }
}

export async function renderAuditSession(
  app: HTMLElement,
  router: Router,
  sessionId: string,
): Promise<void> {
  if (!(await ensureHostAuth(router))) return;
  app.innerHTML = loadingShell('Loading session detail');
  try {
    const detail = await getAuditSession(sessionId);
    paintSessionDetail(app, router, detail);
  } catch (err) {
    paintError(app, router, (err as Error).message);
  }
}

// ----- Auth gate (mirrors home.ts behavior) -----

async function ensureHostAuth(router: Router): Promise<boolean> {
  if (await hasValidStoredAuth()) return true;
  const token = await openPinGate({
    title: 'Audit dashboard',
    message: 'Enter the host PIN to view session audits.',
  });
  if (!token) {
    router.navigate('/');
    return false;
  }
  return true;
}

// ----- Loading / error shells -----

function loadingShell(label: string): string {
  return `
    <div class="audit-shell">
      <div class="audit-loading">
        <div class="audit-spinner" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="audit-loading-label">${escapeHtml(label)}…</div>
      </div>
    </div>
  `;
}

function paintError(app: HTMLElement, router: Router, message: string): void {
  app.innerHTML = `
    <div class="audit-shell">
      <header class="audit-topbar">
        <button data-role="back" class="audit-pill">← Back</button>
        <div class="audit-topbar-title">Audit</div>
        <div></div>
      </header>
      <div class="audit-error">
        <div class="audit-error-icon">!</div>
        <div class="audit-error-title">Couldn't load audit data</div>
        <div class="audit-error-msg">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
  document.querySelector<HTMLElement>('[data-role="back"]')?.addEventListener('click', () => {
    router.navigate('/host');
  });
}

// ----- Dashboard list view -----

interface DashboardMetrics {
  totalSessions: number;
  totalPlayers: number;
  totalAnswers: number;
  totalQuestions: number;
  avgDurationMs: number | null;
  avgAccuracy: number | null;
  activeNow: number;
  endedCount: number;
}

function computeMetrics(sessions: AuditSessionSummary[], events: AuditEvent[]): DashboardMetrics {
  const totalSessions = sessions.length;
  const totalPlayers = sessions.reduce((s, x) => s + (x.joinedPlayerCount ?? 0), 0);
  const totalAnswers = sessions.reduce((s, x) => s + (x.answerCount ?? 0), 0);
  const totalQuestions = sessions.reduce((s, x) => s + (x.questionCount ?? 0), 0);
  const dur = sessions.map((s) => s.durationMs).filter((x): x is number => x !== null);
  const avgDurationMs = dur.length ? Math.round(dur.reduce((a, b) => a + b, 0) / dur.length) : null;
  const correctAnswers = events.filter(
    (e) => e.event === 'player.answered' && e.details && e.details['correct'] === true,
  ).length;
  const totalAnswerEvents = events.filter((e) => e.event === 'player.answered').length;
  const avgAccuracy = totalAnswerEvents > 0 ? correctAnswers / totalAnswerEvents : null;
  const activeNow = sessions.filter(
    (s) => s.state !== 'ended' && s.state !== 'final',
  ).length;
  const endedCount = sessions.filter((s) => s.state === 'ended' || s.state === 'final').length;
  return {
    totalSessions,
    totalPlayers,
    totalAnswers,
    totalQuestions,
    avgDurationMs,
    avgAccuracy,
    activeNow,
    endedCount,
  };
}

function paintDashboard(
  app: HTMLElement,
  router: Router,
  sessions: AuditSessionSummary[],
  recentEvents: AuditEvent[],
): void {
  const metrics = computeMetrics(sessions, recentEvents);
  const activityBuckets = bucketSessionsByDay(sessions, 14);
  const eventBreakdown = breakdownEvents(recentEvents);
  const topQuizzes = topQuizzesByPlayers(sessions, 5);

  app.innerHTML = `
    <div class="audit-shell" data-view="dashboard">
      ${printBranding()}
      <header class="audit-topbar">
        <div class="audit-topbar-left">
          <button data-role="back" class="audit-pill" title="Back to host dashboard">
            ${backArrowSvg()}
            <span>Host</span>
          </button>
        </div>
        <div class="audit-topbar-title">
          <div id="wordmark" class="audit-wordmark"></div>
          <div class="audit-subtitle">Audit Dashboard</div>
        </div>
        <div class="audit-topbar-right">
          <button data-role="refresh" class="audit-pill" title="Refresh">
            ${refreshSvg()}
            <span class="hidden md:inline">Refresh</span>
          </button>
          <button data-role="export" class="audit-pill audit-pill-primary" title="Export PDF">
            ${pdfSvg()}
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      <main class="audit-main">
        <section class="audit-hero">
          <div class="audit-hero-text">
            <div class="audit-eyebrow">Session intelligence</div>
            <h1 class="audit-h1">Every game, every answer, every moment.</h1>
            <p class="audit-lede">
              A live picture of how your quizzes perform — when they ran, who joined,
              how they answered, and where the moments of brilliance and chaos lived.
            </p>
          </div>
          <div class="audit-hero-pulse">
            ${heroPulseSvg(activityBuckets)}
          </div>
        </section>

        <section class="audit-kpi-grid">
          ${kpiCard({
            label: 'Total sessions',
            value: numberFormat(metrics.totalSessions),
            sub: `${metrics.activeNow} active · ${metrics.endedCount} archived`,
            tone: 'ink',
            icon: iconSessions(),
          })}
          ${kpiCard({
            label: 'Players',
            value: numberFormat(metrics.totalPlayers),
            sub: 'Distinct names that joined',
            tone: 'blue',
            icon: iconPlayers(),
          })}
          ${kpiCard({
            label: 'Answers',
            value: numberFormat(metrics.totalAnswers),
            sub: `${numberFormat(metrics.totalQuestions)} questions delivered`,
            tone: 'yellow',
            icon: iconAnswers(),
          })}
          ${kpiCard({
            label: 'Average accuracy',
            value: metrics.avgAccuracy !== null
              ? `${Math.round(metrics.avgAccuracy * 100)}%`
              : '—',
            sub: metrics.avgDurationMs !== null
              ? `Avg duration ${formatDuration(metrics.avgDurationMs)}`
              : 'Avg duration —',
            tone: 'green',
            icon: iconAccuracy(),
          })}
        </section>

        <section class="audit-row">
          <div class="audit-card audit-card-wide">
            <div class="audit-card-head">
              <div>
                <div class="audit-card-title">Activity — last 14 days</div>
                <div class="audit-card-sub">Sessions per day</div>
              </div>
              <div class="audit-card-meta">${activityBuckets.reduce((a, b) => a + b.count, 0)} sessions</div>
            </div>
            <div class="audit-chart">
              ${activitySparkSvg(activityBuckets)}
            </div>
          </div>

          <div class="audit-card">
            <div class="audit-card-head">
              <div>
                <div class="audit-card-title">Event mix</div>
                <div class="audit-card-sub">Recent activity</div>
              </div>
            </div>
            <div class="audit-event-mix">
              ${eventDonutSvg(eventBreakdown)}
              <div class="audit-event-legend">
                ${eventBreakdown.map((b) => `
                  <div class="audit-legend-row">
                    <span class="audit-legend-swatch" style="background:${b.color}"></span>
                    <span class="audit-legend-label">${escapeHtml(prettyEventName(b.event))}</span>
                    <span class="audit-legend-count">${b.count}</span>
                  </div>
                `).join('')}
                ${eventBreakdown.length === 0 ? '<div class="audit-empty-mini">No events yet</div>' : ''}
              </div>
            </div>
          </div>
        </section>

        <section class="audit-row">
          <div class="audit-card audit-card-wide">
            <div class="audit-card-head">
              <div>
                <div class="audit-card-title">Top quizzes by player count</div>
                <div class="audit-card-sub">Across all archived sessions</div>
              </div>
            </div>
            <div class="audit-toplist">
              ${topQuizzes.length === 0
                ? '<div class="audit-empty">No sessions logged yet.</div>'
                : topQuizzes.map((q, i) => topQuizRow(q, i, topQuizzes[0]?.players ?? 1)).join('')}
            </div>
          </div>
        </section>

        <section class="audit-card audit-sessions">
          <div class="audit-card-head">
            <div>
              <div class="audit-card-title">All sessions</div>
              <div class="audit-card-sub">${sessions.length} total · click any row to drill in</div>
            </div>
            <div class="audit-search-wrap">
              <input id="audit-session-search" type="search" placeholder="Search by code, quiz, host…"
                class="audit-search" autocomplete="off" spellcheck="false" />
            </div>
          </div>
          <div class="audit-table-wrap">
            ${sessionsTableHtml(sessions)}
          </div>
        </section>

        <footer class="audit-footer">
          ${moliamFooterMark()}
          <div class="audit-footer-text">
            Generated ${formatTimestamp(Date.now())} · clutch.moliam.com
          </div>
        </footer>
      </main>
    </div>
  `;

  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-2xl' });

  document.querySelector<HTMLElement>('[data-role="back"]')?.addEventListener('click', () => {
    router.navigate('/host');
  });
  document.querySelector<HTMLElement>('[data-role="refresh"]')?.addEventListener('click', () => {
    void renderAuditDashboard(app, router);
  });
  document.querySelector<HTMLElement>('[data-role="export"]')?.addEventListener('click', () => {
    triggerPdfExport('Clutch · Audit Dashboard');
  });

  // Wire row clicks
  app.querySelectorAll<HTMLElement>('[data-session-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.sessionId!;
      router.navigate(`/audit/${id}`);
    });
  });

  // Search filter
  const search = app.querySelector<HTMLInputElement>('#audit-session-search');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      app.querySelectorAll<HTMLElement>('[data-session-search]').forEach((row) => {
        const hay = row.dataset.sessionSearch ?? '';
        row.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }
}

// ----- Session detail view -----

interface AnswerRecord {
  name: string;
  questionIndex: number;
  choiceIndex: number;
  correct: boolean;
  elapsedMs: number;
  scoreDelta: number;
  newScore: number;
  ts: number;
}

interface QuestionSummary {
  index: number;
  text: string;
  options: string[];
  correctIndex: number;
  responses: AnswerRecord[];
  counts: number[];
  correctCount: number;
  accuracy: number | null;
  avgTimeMs: number | null;
  fastestMs: number | null;
  fastestPlayer: string | null;
  unansweredCount: number;
}

function extractAnswers(events: AuditEvent[]): AnswerRecord[] {
  const out: AnswerRecord[] = [];
  for (const e of events) {
    if (e.event !== 'player.answered') continue;
    const d = e.details ?? {};
    const name = typeof d['name'] === 'string' ? (d['name'] as string) : null;
    const questionIndex = typeof d['questionIndex'] === 'number' ? (d['questionIndex'] as number) : null;
    const choiceIndex = typeof d['choiceIndex'] === 'number' ? (d['choiceIndex'] as number) : null;
    if (!name || questionIndex === null || choiceIndex === null) continue;
    out.push({
      name,
      questionIndex,
      choiceIndex,
      correct: d['correct'] === true,
      elapsedMs: typeof d['elapsedMs'] === 'number' ? (d['elapsedMs'] as number) : 0,
      scoreDelta: typeof d['scoreDelta'] === 'number' ? (d['scoreDelta'] as number) : 0,
      newScore: typeof d['newScore'] === 'number' ? (d['newScore'] as number) : 0,
      ts: e.ts,
    });
  }
  return out;
}

function buildQuestionSummaries(d: AuditSessionDetail, answers: AnswerRecord[]): QuestionSummary[] {
  if (!d.quiz) return [];
  // Determine which questions were actually delivered. Prefer the indices we
  // see in question_advanced events — that filters out tail questions a host
  // ended early and avoids inventing zero-row sections for them.
  const deliveredFromEvents = new Set<number>();
  for (const e of d.events) {
    if (e.event !== 'session.question_advanced' && e.event !== 'session.question_skipped') continue;
    const qi = e.details && typeof e.details['questionIndex'] === 'number'
      ? (e.details['questionIndex'] as number) : null;
    if (qi !== null) deliveredFromEvents.add(qi);
  }
  // Fall back to "every question that has at least one answer or that the quiz
  // contains" if no advance events were captured (older sessions, edge cases).
  const indices = deliveredFromEvents.size > 0
    ? [...deliveredFromEvents].sort((a, b) => a - b)
    : d.quiz.questions.map((q) => q.position);

  const playerCount = d.joinedPlayerCount || d.players.length;

  return indices.map((idx) => {
    const q = d.quiz!.questions.find((x) => x.position === idx)
      ?? { position: idx, text: '(question not in current quiz)', options: ['', '', '', ''], correctIndex: 0 };
    const responses = answers.filter((a) => a.questionIndex === idx);
    const optionCount = q.options.length || 4;
    const counts = new Array<number>(optionCount).fill(0);
    let correctCount = 0;
    let totalElapsed = 0;
    let fastestMs: number | null = null;
    let fastestPlayer: string | null = null;
    for (const r of responses) {
      if (r.choiceIndex >= 0 && r.choiceIndex < counts.length) counts[r.choiceIndex]!++;
      if (r.correct) correctCount++;
      totalElapsed += r.elapsedMs;
      if (fastestMs === null || r.elapsedMs < fastestMs) {
        fastestMs = r.elapsedMs;
        fastestPlayer = r.name;
      }
    }
    const accuracy = responses.length > 0 ? correctCount / responses.length : null;
    const avgTimeMs = responses.length > 0 ? totalElapsed / responses.length : null;
    const unansweredCount = Math.max(0, playerCount - responses.length);
    return {
      index: idx,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      responses,
      counts,
      correctCount,
      accuracy,
      avgTimeMs,
      fastestMs,
      fastestPlayer,
      unansweredCount,
    };
  });
}

interface ClassInsights {
  hardest: QuestionSummary | null;
  easiest: QuestionSummary | null;
  fastestAnswer: AnswerRecord | null;
  avgResponseMs: number | null;
  participation: number | null;
  topScorer: AuditPlayer | null;
}

function computeClassInsights(d: AuditSessionDetail, summaries: QuestionSummary[], answers: AnswerRecord[]): ClassInsights {
  const ranked = summaries.filter((s) => s.accuracy !== null);
  // Hardest = lowest accuracy. Easiest = highest accuracy (with at least one
  // response). Ties broken by index to keep output deterministic.
  const hardest = ranked.length
    ? [...ranked].sort((a, b) => (a.accuracy! - b.accuracy!) || a.index - b.index)[0] ?? null
    : null;
  const easiest = ranked.length
    ? [...ranked].sort((a, b) => (b.accuracy! - a.accuracy!) || a.index - b.index)[0] ?? null
    : null;
  let fastestAnswer: AnswerRecord | null = null;
  for (const a of answers) {
    if (!a.correct) continue;
    if (!fastestAnswer || a.elapsedMs < fastestAnswer.elapsedMs) fastestAnswer = a;
  }
  const totalElapsed = answers.reduce((s, a) => s + a.elapsedMs, 0);
  const avgResponseMs = answers.length > 0 ? totalElapsed / answers.length : null;
  const expectedAnswers = (d.joinedPlayerCount || d.players.length) * d.questionCount;
  const participation = expectedAnswers > 0 ? Math.min(1, answers.length / expectedAnswers) : null;
  const topScorer = d.players.length > 0
    ? [...d.players].sort((a, b) => (a.finalRank ?? 1e9) - (b.finalRank ?? 1e9))[0] ?? null
    : null;
  return { hardest, easiest, fastestAnswer, avgResponseMs, participation, topScorer };
}

function paintSessionDetail(app: HTMLElement, router: Router, d: AuditSessionDetail): void {
  const accuracy = d.answerCount > 0
    ? d.players.reduce((a, p) => a + p.correct, 0) / d.answerCount
    : null;
  const startedAt = d.firstStartedAt ?? d.createdAt;
  const endedAt = d.endedAt;
  const answers = extractAnswers(d.events);
  const summaries = buildQuestionSummaries(d, answers);
  const insights = computeClassInsights(d, summaries, answers);
  const groupedTimeline = groupTimeline(d.events);

  app.innerHTML = `
    <div class="audit-shell" data-view="session">
      ${printBranding()}
      <header class="audit-topbar">
        <div class="audit-topbar-left">
          <button data-role="back" class="audit-pill">
            ${backArrowSvg()}
            <span>Audit</span>
          </button>
        </div>
        <div class="audit-topbar-title">
          <div id="wordmark" class="audit-wordmark"></div>
          <div class="audit-subtitle">Session report</div>
        </div>
        <div class="audit-topbar-right">
          <button data-role="export" class="audit-pill audit-pill-primary">
            ${pdfSvg()}
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      <main class="audit-main">
        <!-- Cover / executive summary -->
        <section class="audit-cover">
          <div class="audit-cover-bg" aria-hidden="true"></div>
          <div class="audit-cover-grid">
            <div class="audit-cover-text">
              <div class="audit-eyebrow audit-cover-eyebrow">Session Report</div>
              <h1 class="audit-cover-title">${escapeHtml(d.quizName ?? 'Untitled quiz')}</h1>
              <div class="audit-cover-meta">
                ${stateBadgeHtml(d.state)}
                <span class="audit-cover-meta-sep">·</span>
                <span>${formatTimestamp(startedAt)}</span>
                ${d.durationMs !== null ? `<span class="audit-cover-meta-sep">·</span><span>${formatDuration(d.durationMs)}</span>` : ''}
              </div>
              <p class="audit-cover-lede">
                ${coverLede(d, accuracy)}
              </p>
              <div class="audit-cover-host">
                <span class="audit-cover-host-label">Hosted by</span>
                <span class="audit-cover-host-name">${escapeHtml(d.hostActor ?? 'unknown')}</span>
              </div>
            </div>
            <div class="audit-cover-codeblock">
              <div class="audit-eyebrow">Game code</div>
              <div class="audit-cover-code">${formatCode(d.code)}</div>
              <div class="audit-cover-id">${escapeHtml(d.sessionId)}</div>
            </div>
          </div>
        </section>

        <!-- Executive summary KPIs -->
        <section class="audit-kpi-grid">
          ${kpiCard({
            label: 'Players',
            value: numberFormat(d.joinedPlayerCount),
            sub: `Peak ${d.peakPlayerCount} concurrent`,
            tone: 'blue',
            icon: iconPlayers(),
          })}
          ${kpiCard({
            label: 'Questions delivered',
            value: numberFormat(d.questionCount),
            sub: `${numberFormat(d.answerCount)} answers recorded`,
            tone: 'yellow',
            icon: iconAnswers(),
          })}
          ${kpiCard({
            label: 'Class accuracy',
            value: accuracy !== null ? `${Math.round(accuracy * 100)}%` : '—',
            sub: accuracy !== null ? 'Correct ÷ answered' : 'No answers recorded',
            tone: 'green',
            icon: iconAccuracy(),
          })}
          ${kpiCard({
            label: 'Avg response',
            value: insights.avgResponseMs !== null ? `${(insights.avgResponseMs / 1000).toFixed(1)}s` : '—',
            sub: insights.participation !== null
              ? `${Math.round(insights.participation * 100)}% participation`
              : 'No participation data',
            tone: 'ink',
            icon: iconClock(),
          })}
        </section>

        <!-- Class insights strip -->
        <section class="audit-insights">
          ${insightCard({
            label: 'Hardest question',
            primary: insights.hardest
              ? `Q${insights.hardest.index + 1} · ${Math.round((insights.hardest.accuracy ?? 0) * 100)}%`
              : '—',
            secondary: insights.hardest ? truncate(insights.hardest.text, 80) : 'Not enough data',
            accent: 'red',
            icon: iconHardest(),
          })}
          ${insightCard({
            label: 'Easiest question',
            primary: insights.easiest
              ? `Q${insights.easiest.index + 1} · ${Math.round((insights.easiest.accuracy ?? 0) * 100)}%`
              : '—',
            secondary: insights.easiest ? truncate(insights.easiest.text, 80) : 'Not enough data',
            accent: 'green',
            icon: iconEasiest(),
          })}
          ${insightCard({
            label: 'Fastest correct answer',
            primary: insights.fastestAnswer
              ? `${(insights.fastestAnswer.elapsedMs / 1000).toFixed(2)}s`
              : '—',
            secondary: insights.fastestAnswer
              ? `${insights.fastestAnswer.name} · Q${insights.fastestAnswer.questionIndex + 1}`
              : 'No correct answers',
            accent: 'blue',
            icon: iconLightning(),
          })}
          ${insightCard({
            label: 'Top scorer',
            primary: insights.topScorer
              ? `${insights.topScorer.name}`
              : '—',
            secondary: insights.topScorer && insights.topScorer.finalScore !== null
              ? `${numberFormat(insights.topScorer.finalScore)} pts · Rank ${insights.topScorer.finalRank ?? '—'}`
              : 'Pending',
            accent: 'yellow',
            icon: iconTrophy(),
          })}
        </section>

        <!-- Standings + accuracy donut -->
        <section class="audit-row">
          <div class="audit-card audit-card-wide">
            <div class="audit-card-head">
              <div>
                <div class="audit-card-title">Final standings</div>
                <div class="audit-card-sub">Ranked by score · accuracy bar</div>
              </div>
            </div>
            <div class="audit-player-list">
              ${d.players.length === 0
                ? '<div class="audit-empty">No players joined this session.</div>'
                : d.players.map(playerRowHtml).join('')}
            </div>
          </div>

          <div class="audit-card">
            <div class="audit-card-head">
              <div>
                <div class="audit-card-title">Class accuracy</div>
                <div class="audit-card-sub">Across the room</div>
              </div>
            </div>
            <div class="audit-accuracy-wrap">
              ${accuracyDonutSvg(accuracy)}
              <div class="audit-accuracy-meta">
                <div><span class="audit-dot audit-dot-green"></span>Correct</div>
                <div><span class="audit-dot audit-dot-mute"></span>Incorrect</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Per-question breakdown -->
        <section class="audit-section-break">
          <div class="audit-section-rule"></div>
          <div class="audit-section-title">Question-by-question review</div>
          <div class="audit-section-sub">Read the room — what was asked, who answered what, and how fast.</div>
        </section>

        ${summaries.length === 0
          ? '<div class="audit-card audit-empty">No questions were delivered in this session.</div>'
          : summaries.map((q) => questionBreakdownHtml(q)).join('')}

        <!-- Per-player report cards -->
        <section class="audit-section-break">
          <div class="audit-section-rule"></div>
          <div class="audit-section-title">Player report cards</div>
          <div class="audit-section-sub">A printable transcript per player for class review and follow-up.</div>
        </section>

        ${d.players.length === 0
          ? '<div class="audit-card audit-empty">No player transcripts available.</div>'
          : d.players.map((p) => playerReportCardHtml(p, d, summaries, answers)).join('')}

        <!-- Activity log -->
        <section class="audit-section-break">
          <div class="audit-section-rule"></div>
          <div class="audit-section-title">Activity log</div>
          <div class="audit-section-sub">Full chronological record · ${d.events.length} event${d.events.length === 1 ? '' : 's'}</div>
        </section>

        <section class="audit-card">
          <div class="audit-grouped-timeline">
            ${groupedTimeline.length === 0
              ? '<div class="audit-empty">No events recorded.</div>'
              : groupedTimeline.map((g) => timelineGroupHtml(g, d, summaries)).join('')}
          </div>
        </section>

        <footer class="audit-footer">
          ${moliamFooterMark()}
          <div class="audit-footer-text">
            Session ${d.sessionId}
            <br />Generated ${formatTimestamp(Date.now())} · clutch.moliam.com
          </div>
        </footer>
      </main>
    </div>
  `;

  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-2xl' });

  document.querySelector<HTMLElement>('[data-role="back"]')?.addEventListener('click', () => {
    router.navigate('/audit');
  });
  document.querySelector<HTMLElement>('[data-role="export"]')?.addEventListener('click', () => {
    triggerPdfExport(`Clutch · ${d.quizName ?? 'Session'} · ${d.code}`);
  });
}

// ----- Cover lede / executive narrative -----

function coverLede(d: AuditSessionDetail, accuracy: number | null): string {
  const players = d.joinedPlayerCount;
  const qs = d.questionCount;
  const acc = accuracy !== null ? Math.round(accuracy * 100) : null;
  if (players === 0) {
    return 'Session was created but no players joined. Use this report to verify configuration before the next run.';
  }
  if (qs === 0) {
    return `${players} player${players === 1 ? '' : 's'} joined the lobby but the game was ended before the first question. Review the activity log to confirm.`;
  }
  const accClause = acc === null
    ? ''
    : acc >= 85
      ? ` Class accuracy was ${acc}% — strong group recall.`
      : acc >= 60
        ? ` Class accuracy landed at ${acc}% — solid coverage with a few softer spots.`
        : ` Class accuracy came in at ${acc}% — this set looks like a clear coaching opportunity.`;
  return `${players} player${players === 1 ? '' : 's'} answered ${d.answerCount} question${d.answerCount === 1 ? '' : 's'} across ${qs} round${qs === 1 ? '' : 's'}.${accClause}`;
}

// ----- Per-question card -----

function questionBreakdownHtml(q: QuestionSummary): string {
  const totalResponses = q.responses.length;
  const max = Math.max(1, ...q.counts);
  const correctText = q.options[q.correctIndex] ?? '';
  return `
    <article class="audit-card audit-question-card">
      <header class="audit-question-head">
        <div class="audit-question-num">Q${q.index + 1}</div>
        <div class="audit-question-headline">
          <div class="audit-question-text">${escapeHtml(q.text)}</div>
          <div class="audit-question-meta">
            <span class="audit-chip audit-chip-green">Correct: ${escapeHtml(truncate(correctText, 60))}</span>
            <span class="audit-chip-mute">${totalResponses} response${totalResponses === 1 ? '' : 's'}</span>
            ${q.unansweredCount > 0 ? `<span class="audit-chip-mute">${q.unansweredCount} no answer</span>` : ''}
          </div>
        </div>
        <div class="audit-question-stats">
          <div class="audit-question-stat">
            <div class="audit-question-stat-value">${q.accuracy !== null ? `${Math.round(q.accuracy * 100)}%` : '—'}</div>
            <div class="audit-question-stat-label">accuracy</div>
          </div>
          <div class="audit-question-stat">
            <div class="audit-question-stat-value">${q.avgTimeMs !== null ? `${(q.avgTimeMs / 1000).toFixed(1)}s` : '—'}</div>
            <div class="audit-question-stat-label">avg time</div>
          </div>
          <div class="audit-question-stat">
            <div class="audit-question-stat-value">${q.fastestMs !== null ? `${(q.fastestMs / 1000).toFixed(2)}s` : '—'}</div>
            <div class="audit-question-stat-label">${q.fastestPlayer ? truncate(q.fastestPlayer, 12) : 'fastest'}</div>
          </div>
        </div>
      </header>

      <div class="audit-options">
        ${q.options.map((opt, i) => optionRowHtml({
          label: opt,
          tileColor: tileColorFor(i),
          shape: tileShapeFor(i),
          count: q.counts[i] ?? 0,
          totalResponses,
          max,
          isCorrect: i === q.correctIndex,
          chosenBy: q.responses.filter((r) => r.choiceIndex === i).map((r) => r.name),
        })).join('')}
      </div>
    </article>
  `;
}

interface OptionRowOpts {
  label: string;
  tileColor: 'red' | 'blue' | 'yellow' | 'green';
  shape: 'triangle' | 'diamond' | 'circle' | 'square';
  count: number;
  totalResponses: number;
  max: number;
  isCorrect: boolean;
  chosenBy: string[];
}

function optionRowHtml(o: OptionRowOpts): string {
  const pctOfTotal = o.totalResponses > 0 ? Math.round((o.count / o.totalResponses) * 100) : 0;
  const widthPct = Math.max(2, Math.round((o.count / o.max) * 100));
  return `
    <div class="audit-option ${o.isCorrect ? 'audit-option-correct' : ''}">
      <div class="audit-option-shape audit-option-${o.tileColor}">
        ${optionShapeSvg(o.shape)}
      </div>
      <div class="audit-option-body">
        <div class="audit-option-head">
          <div class="audit-option-label">${escapeHtml(o.label || '—')}</div>
          ${o.isCorrect ? `<span class="audit-chip audit-chip-green">correct</span>` : ''}
        </div>
        <div class="audit-option-bar">
          <div class="audit-option-fill audit-option-fill-${o.tileColor}" style="width:${widthPct}%"></div>
        </div>
        ${o.chosenBy.length > 0
          ? `<div class="audit-option-chips">${o.chosenBy.map((n) => `<span class="audit-name-chip">${escapeHtml(n)}</span>`).join('')}</div>`
          : '<div class="audit-option-chips audit-option-chips-empty">No one selected this</div>'}
      </div>
      <div class="audit-option-count">
        <div class="audit-option-count-value">${o.count}</div>
        <div class="audit-option-count-pct">${pctOfTotal}%</div>
      </div>
    </div>
  `;
}

// ----- Per-player report card -----

function playerReportCardHtml(
  p: AuditPlayer,
  d: AuditSessionDetail,
  summaries: QuestionSummary[],
  answers: AnswerRecord[],
): string {
  const playerAnswers = answers.filter((a) => a.name === p.name);
  const byIndex = new Map(playerAnswers.map((a) => [a.questionIndex, a]));
  const accuracy = p.answers > 0 ? p.correct / p.answers : 0;
  const avgTimeMs = playerAnswers.length > 0
    ? playerAnswers.reduce((s, a) => s + a.elapsedMs, 0) / playerAnswers.length
    : null;
  const rankClass = p.finalRank ? `audit-player-rank-${Math.min(3, p.finalRank)}` : 'audit-player-rank-x';
  return `
    <article class="audit-card audit-player-card">
      <header class="audit-player-card-head">
        <div class="audit-player-card-rank ${rankClass}">${p.finalRank ?? '—'}</div>
        <div class="audit-player-card-id">
          <div class="audit-player-card-name">${escapeHtml(p.name)}</div>
          <div class="audit-player-card-sub">
            ${p.finalScore !== null ? `${numberFormat(p.finalScore)} pts · ` : ''}
            ${p.correct} of ${p.answers} correct
            ${avgTimeMs !== null ? ` · avg ${(avgTimeMs / 1000).toFixed(1)}s` : ''}
          </div>
        </div>
        <div class="audit-player-card-stats">
          <div class="audit-player-card-stat">
            <div class="audit-player-card-stat-value">${Math.round(accuracy * 100)}%</div>
            <div class="audit-player-card-stat-label">accuracy</div>
          </div>
          <div class="audit-player-card-stat">
            <div class="audit-player-card-stat-value">${p.correct}/${p.answers || '0'}</div>
            <div class="audit-player-card-stat-label">correct</div>
          </div>
        </div>
      </header>
      <div class="audit-transcript">
        ${summaries.length === 0
          ? '<div class="audit-empty-mini">No question data.</div>'
          : summaries.map((q) => transcriptRowHtml(q, byIndex.get(q.index) ?? null)).join('')}
      </div>
    </article>
  `;
}

function transcriptRowHtml(q: QuestionSummary, ans: AnswerRecord | null): string {
  const correctText = q.options[q.correctIndex] ?? '';
  const playerText = ans ? (q.options[ans.choiceIndex] ?? '') : '';
  const status = ans === null
    ? { cls: 'audit-trans-none', label: 'No answer', icon: dashIconSvg() }
    : ans.correct
      ? { cls: 'audit-trans-correct', label: 'Correct', icon: checkIconSvg() }
      : { cls: 'audit-trans-wrong', label: 'Wrong', icon: crossIconSvg() };
  return `
    <div class="audit-trans-row ${status.cls}">
      <div class="audit-trans-q">Q${q.index + 1}</div>
      <div class="audit-trans-body">
        <div class="audit-trans-question">${escapeHtml(q.text)}</div>
        <div class="audit-trans-pick">
          <div class="audit-trans-pick-row">
            <span class="audit-trans-pick-label">Picked</span>
            <span class="audit-trans-pick-value">${ans ? escapeHtml(playerText || '—') : '—'}</span>
          </div>
          ${ans === null || !ans.correct
            ? `<div class="audit-trans-pick-row audit-trans-correct-line">
                 <span class="audit-trans-pick-label">Correct</span>
                 <span class="audit-trans-pick-value">${escapeHtml(correctText)}</span>
               </div>`
            : ''}
        </div>
      </div>
      <div class="audit-trans-status">
        <div class="audit-trans-icon">${status.icon}</div>
        <div class="audit-trans-label">${status.label}</div>
        ${ans !== null ? `<div class="audit-trans-time">${(ans.elapsedMs / 1000).toFixed(2)}s${ans.scoreDelta > 0 ? ` · +${ans.scoreDelta}` : ''}</div>` : ''}
      </div>
    </div>
  `;
}

// ----- Grouped timeline -----

interface TimelineGroup {
  kind: 'pregame' | 'question' | 'postgame';
  questionIndex?: number;
  events: AuditEvent[];
}

function groupTimeline(events: AuditEvent[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  let pregame: AuditEvent[] = [];
  let postgame: AuditEvent[] = [];
  const byQuestion = new Map<number, AuditEvent[]>();
  let started = false;
  let ended = false;
  for (const e of events) {
    if (e.event === 'session.started') started = true;
    if (e.event === 'session.ended') ended = true;
    const qi = e.details && typeof e.details['questionIndex'] === 'number'
      ? (e.details['questionIndex'] as number) : null;
    if (qi !== null && (e.event === 'session.question_advanced'
      || e.event === 'session.question_skipped'
      || e.event === 'player.answered')) {
      const arr = byQuestion.get(qi) ?? [];
      arr.push(e);
      byQuestion.set(qi, arr);
    } else if (!started || (!ended && e.event === 'session.started')) {
      pregame.push(e);
    } else if (ended && e.event === 'session.ended') {
      postgame.push(e);
    } else if (e.event === 'session.created'
      || e.event === 'player.joined'
      || e.event === 'player.rejoined'
      || e.event === 'session.started') {
      pregame.push(e);
    } else if (e.event === 'session.ended') {
      postgame.push(e);
    } else {
      // session.paused / resumed / unknown — slot under pregame if we haven't
      // begun, otherwise post.
      (started ? postgame : pregame).push(e);
    }
  }
  if (pregame.length) groups.push({ kind: 'pregame', events: pregame });
  for (const idx of [...byQuestion.keys()].sort((a, b) => a - b)) {
    groups.push({ kind: 'question', questionIndex: idx, events: byQuestion.get(idx)! });
  }
  if (postgame.length) groups.push({ kind: 'postgame', events: postgame });
  return groups;
}

function timelineGroupHtml(g: TimelineGroup, d: AuditSessionDetail, summaries: QuestionSummary[]): string {
  const baseTs = d.events[0]?.ts ?? Date.now();
  const headerLabel = g.kind === 'pregame'
    ? 'Pre-game'
    : g.kind === 'postgame'
      ? 'Game over'
      : `Question ${(g.questionIndex ?? 0) + 1}`;
  const summary = g.kind === 'question'
    ? summaries.find((s) => s.index === g.questionIndex)
    : null;
  const headerSub = summary
    ? truncate(summary.text, 90)
    : g.kind === 'pregame'
      ? 'Setup, joins, and game start'
      : 'Final wrap-up';
  return `
    <div class="audit-timeline-group">
      <div class="audit-timeline-group-head">
        <div class="audit-timeline-group-pill audit-timeline-pill-${g.kind}">${escapeHtml(headerLabel)}</div>
        <div class="audit-timeline-group-sub">${escapeHtml(headerSub)}</div>
      </div>
      <div class="audit-timeline">
        ${g.events.map((e, i) => timelineEventHtml(e, i, baseTs, summary)).join('')}
      </div>
    </div>
  `;
}

// ----- Helpers (truncate + tile mapping + insight cards) -----

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function tileColorFor(i: number): 'red' | 'blue' | 'yellow' | 'green' {
  return (['red', 'blue', 'yellow', 'green'] as const)[i] ?? 'red';
}
function tileShapeFor(i: number): 'triangle' | 'diamond' | 'circle' | 'square' {
  return (['triangle', 'diamond', 'circle', 'square'] as const)[i] ?? 'triangle';
}
function optionShapeSvg(shape: 'triangle' | 'diamond' | 'circle' | 'square'): string {
  switch (shape) {
    case 'triangle':
      return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4l9 16H3z" fill="currentColor"/></svg>`;
    case 'diamond':
      return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l10 10-10 10L2 12z" fill="currentColor"/></svg>`;
    case 'circle':
      return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>`;
    case 'square':
      return `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="currentColor"/></svg>`;
  }
}

interface InsightCardOpts {
  label: string;
  primary: string;
  secondary: string;
  accent: 'red' | 'green' | 'blue' | 'yellow';
  icon: string;
}
function insightCard(o: InsightCardOpts): string {
  return `
    <div class="audit-insight audit-insight-${o.accent}">
      <div class="audit-insight-icon">${o.icon}</div>
      <div class="audit-insight-body">
        <div class="audit-insight-label">${escapeHtml(o.label)}</div>
        <div class="audit-insight-primary">${escapeHtml(o.primary)}</div>
        <div class="audit-insight-secondary">${escapeHtml(o.secondary)}</div>
      </div>
    </div>
  `;
}

function iconHardest(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5v6c0 5-3.5 8-9 9-5.5-1-9-4-9-9V7z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;
}
function iconEasiest(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>`;
}
function iconLightning(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`;
}
function iconTrophy(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M16 6h3v2a3 3 0 0 1-3 3"/><path d="M8 6H5v2a3 3 0 0 0 3 3"/><path d="M10 14h4"/><path d="M12 14v4"/><path d="M9 20h6"/></svg>`;
}
function checkIconSvg(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`;
}
function crossIconSvg(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M6 18L18 6"/></svg>`;
}
function dashIconSvg(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"/></svg>`;
}

// ----- Cards / table builders -----

interface KpiOpts {
  label: string;
  value: string;
  sub: string;
  tone: 'ink' | 'blue' | 'yellow' | 'green' | 'red';
  icon: string;
}

function kpiCard(o: KpiOpts): string {
  return `
    <div class="audit-kpi audit-kpi-${o.tone}">
      <div class="audit-kpi-icon">${o.icon}</div>
      <div class="audit-kpi-body">
        <div class="audit-kpi-label">${escapeHtml(o.label)}</div>
        <div class="audit-kpi-value">${o.value}</div>
        <div class="audit-kpi-sub">${escapeHtml(o.sub)}</div>
      </div>
    </div>
  `;
}

function sessionsTableHtml(rows: AuditSessionSummary[]): string {
  if (rows.length === 0) {
    return `<div class="audit-empty">No sessions yet — host a game to populate this dashboard.</div>`;
  }
  return `
    <table class="audit-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Quiz</th>
          <th>Code</th>
          <th>Host</th>
          <th>State</th>
          <th class="num">Players</th>
          <th class="num">Q</th>
          <th class="num">Answers</th>
          <th class="num">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((s) => sessionRowHtml(s)).join('')}
      </tbody>
    </table>
  `;
}

function sessionRowHtml(s: AuditSessionSummary): string {
  const search = [
    s.code,
    s.quizName ?? '',
    s.hostActor ?? '',
    s.state,
  ].join(' ').toLowerCase();
  return `
    <tr data-session-id="${escapeHtml(s.sessionId)}" data-session-search="${escapeHtml(search)}">
      <td>
        <div class="audit-row-when">${formatRelative(s.createdAt)}</div>
        <div class="audit-row-when-sub">${formatTimestamp(s.createdAt)}</div>
      </td>
      <td class="audit-row-quiz">${escapeHtml(s.quizName ?? '—')}</td>
      <td><span class="audit-mono">${formatCode(s.code)}</span></td>
      <td class="audit-row-host">${escapeHtml(s.hostActor ?? '—')}</td>
      <td>${stateBadgeHtml(s.state)}</td>
      <td class="num">${s.joinedPlayerCount}</td>
      <td class="num">${s.questionCount}</td>
      <td class="num">${s.answerCount}</td>
      <td class="num">${s.durationMs !== null ? formatDuration(s.durationMs) : '—'}</td>
    </tr>
  `;
}

function topQuizRow(q: { name: string; players: number; sessions: number }, idx: number, max: number): string {
  const pct = Math.max(2, Math.round((q.players / Math.max(1, max)) * 100));
  return `
    <div class="audit-toplist-row">
      <div class="audit-toplist-rank">${idx + 1}</div>
      <div class="audit-toplist-body">
        <div class="audit-toplist-name">${escapeHtml(q.name)}</div>
        <div class="audit-toplist-bar">
          <div class="audit-toplist-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="audit-toplist-meta">
        <div class="audit-toplist-num">${q.players}</div>
        <div class="audit-toplist-sub">${q.sessions} session${q.sessions === 1 ? '' : 's'}</div>
      </div>
    </div>
  `;
}

function playerRowHtml(p: AuditPlayer): string {
  const acc = p.answers > 0 ? p.correct / p.answers : 0;
  const accPct = Math.round(acc * 100);
  const rankBadge = p.finalRank
    ? `<div class="audit-player-rank audit-player-rank-${Math.min(3, p.finalRank)}">${p.finalRank}</div>`
    : `<div class="audit-player-rank audit-player-rank-x">—</div>`;
  return `
    <div class="audit-player-row">
      ${rankBadge}
      <div class="audit-player-body">
        <div class="audit-player-name">${escapeHtml(p.name)}</div>
        <div class="audit-player-bar">
          <div class="audit-player-fill" style="width:${accPct}%"></div>
        </div>
        <div class="audit-player-foot">
          ${p.correct} / ${p.answers} correct · ${accPct}%
          ${p.finalScore !== null ? ` · ${p.finalScore} pts` : ''}
        </div>
      </div>
    </div>
  `;
}

function timelineEventHtml(e: AuditEvent, idx: number, baseTs: number, summary?: QuestionSummary | null): string {
  const offset = e.ts - baseTs;
  const offsetLabel = offset === 0 ? '0:00' : formatRelativeOffset(offset);
  return `
    <div class="audit-timeline-row" style="animation-delay:${Math.min(idx, 30) * 18}ms">
      <div class="audit-timeline-tick">
        <span class="audit-timeline-dot audit-event-${eventKind(e.event)}"></span>
      </div>
      <div class="audit-timeline-time">
        <div class="audit-timeline-offset">${offsetLabel}</div>
        <div class="audit-timeline-abs">${formatTime(e.ts)}</div>
      </div>
      <div class="audit-timeline-body">
        <div class="audit-timeline-name">${escapeHtml(prettyEventName(e.event))}</div>
        ${formatDetailHtml(e, summary)}
      </div>
    </div>
  `;
}

function formatDetailHtml(e: AuditEvent, summary?: QuestionSummary | null): string {
  const d = e.details ?? {};
  const parts: string[] = [];
  const name = typeof d['name'] === 'string' ? (d['name'] as string) : null;
  const choiceIndex = typeof d['choiceIndex'] === 'number' ? (d['choiceIndex'] as number) : null;
  const elapsedMs = typeof d['elapsedMs'] === 'number' ? (d['elapsedMs'] as number) : null;
  const scoreDelta = typeof d['scoreDelta'] === 'number' ? (d['scoreDelta'] as number) : null;

  if (name) parts.push(`<span class="audit-chip">${escapeHtml(name)}</span>`);

  if (e.event === 'player.answered' && summary && choiceIndex !== null) {
    const picked = summary.options[choiceIndex] ?? '';
    parts.push(`<span class="audit-chip-mute">picked: ${escapeHtml(truncate(picked || '—', 40))}</span>`);
    if (d['correct'] === true) parts.push(`<span class="audit-chip audit-chip-green">correct</span>`);
    else parts.push(`<span class="audit-chip audit-chip-red">wrong · was ${escapeHtml(truncate(summary.options[summary.correctIndex] ?? '', 40))}</span>`);
    if (elapsedMs !== null) parts.push(`<span class="audit-chip-mute">${(elapsedMs / 1000).toFixed(2)}s</span>`);
    if (scoreDelta !== null && scoreDelta > 0) parts.push(`<span class="audit-chip-mute">+${scoreDelta}</span>`);
  } else if (e.event === 'player.answered') {
    if (d['correct'] === true) parts.push(`<span class="audit-chip audit-chip-green">correct</span>`);
    if (d['correct'] === false) parts.push(`<span class="audit-chip audit-chip-red">wrong</span>`);
    if (elapsedMs !== null) parts.push(`<span class="audit-chip-mute">${(elapsedMs / 1000).toFixed(2)}s</span>`);
  } else if (e.event === 'session.question_advanced' && summary) {
    parts.push(`<span class="audit-chip-mute">${escapeHtml(truncate(summary.text, 60))}</span>`);
  } else if (e.event === 'session.question_skipped' && summary) {
    parts.push(`<span class="audit-chip-mute">skipped · ${escapeHtml(truncate(summary.text, 50))}</span>`);
  } else if (e.actor && !name) {
    parts.push(`<span class="audit-chip-mute">${escapeHtml(e.actor)}</span>`);
  }
  if (parts.length === 0) return '';
  return `<div class="audit-timeline-meta">${parts.join('')}</div>`;
}

// ----- SVG charts -----

function heroPulseSvg(buckets: { day: string; count: number }[]): string {
  const w = 320;
  const h = 90;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const step = w / Math.max(1, buckets.length - 1);
  const points = buckets.map((b, i) => {
    const x = i * step;
    const y = h - 6 - (b.count / max) * (h - 18);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = points.length ? `M ${points.join(' L ')}` : '';
  const area = points.length
    ? `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`
    : '';
  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="audit-hero-pulse-svg">
      <defs>
        <linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0F0F14" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#0F0F14" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#heroFill)"/>
      <path d="${path}" fill="none" stroke="#0F0F14" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
      ${buckets.map((b, i) => {
        const x = i * step;
        const y = h - 6 - (b.count / max) * (h - 18);
        if (b.count === 0) return '';
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#0F0F14"/>`;
      }).join('')}
    </svg>
  `;
}

function activitySparkSvg(buckets: { day: string; count: number }[]): string {
  const w = 880;
  const h = 220;
  const padX = 24;
  const padY = 24;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const barW = innerW / buckets.length;
  return `
    <svg viewBox="0 0 ${w} ${h}" class="audit-spark-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="barFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0F0F14"/>
          <stop offset="100%" stop-color="#3F3F46"/>
        </linearGradient>
      </defs>
      ${[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padY + innerH - innerH * f;
        return `<line x1="${padX}" x2="${w - padX}" y1="${y}" y2="${y}" stroke="#0F0F14" stroke-opacity="0.06" stroke-dasharray="2 4"/>`;
      }).join('')}
      ${buckets.map((b, i) => {
        const x = padX + i * barW + barW * 0.18;
        const bw = barW * 0.64;
        const bh = (b.count / max) * innerH;
        const y = padY + innerH - bh;
        return `
          <g class="audit-bar" style="--ad:${i * 30}ms">
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}"
              rx="6" fill="url(#barFill)" />
            ${b.count > 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle"
              font-size="10" font-family="JetBrains Mono, monospace" fill="#0F0F14">${b.count}</text>` : ''}
          </g>
        `;
      }).join('')}
      ${buckets.map((b, i) => {
        const x = padX + i * barW + barW / 2;
        const y = h - 6;
        return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle"
          font-size="10" font-family="Inter, sans-serif" fill="#6B7280">${escapeHtml(b.day)}</text>`;
      }).join('')}
    </svg>
  `;
}

function eventDonutSvg(buckets: { event: string; count: number; color: string }[]): string {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (total === 0) {
    return `
      <svg viewBox="0 0 160 160" class="audit-donut-svg">
        <circle cx="80" cy="80" r="60" fill="none" stroke="#0F0F14" stroke-opacity="0.08" stroke-width="20"/>
        <text x="80" y="86" text-anchor="middle" font-size="14" fill="#6B7280">No data</text>
      </svg>
    `;
  }
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  const arcs = buckets.map((b) => {
    const frac = b.count / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const offset = circumference * (1 - acc);
    acc += frac;
    const a = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${b.color}"
      stroke-width="20" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    return a;
  }).join('');
  return `
    <svg viewBox="0 0 160 160" class="audit-donut-svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0F0F14" stroke-opacity="0.06" stroke-width="20"/>
      ${arcs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700"
        font-family="Inter, sans-serif" fill="#0F0F14">${numberFormat(total)}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11"
        font-family="Inter, sans-serif" fill="#6B7280" letter-spacing="0.15em">EVENTS</text>
    </svg>
  `;
}

function accuracyDonutSvg(accuracy: number | null): string {
  if (accuracy === null) {
    return `
      <svg viewBox="0 0 160 160" class="audit-donut-svg">
        <circle cx="80" cy="80" r="60" fill="none" stroke="#0F0F14" stroke-opacity="0.08" stroke-width="20"/>
        <text x="80" y="86" text-anchor="middle" font-size="14" fill="#6B7280">No data</text>
      </svg>
    `;
  }
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash = accuracy * c;
  return `
    <svg viewBox="0 0 160 160" class="audit-donut-svg">
      <defs>
        <linearGradient id="accFill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#38A169"/>
          <stop offset="100%" stop-color="#1F8454"/>
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="#0F0F14" stroke-opacity="0.07" stroke-width="20"/>
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="url(#accFill)" stroke-width="20"
        stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
        stroke-linecap="round"
        transform="rotate(-90 80 80)"/>
      <text x="80" y="76" text-anchor="middle" font-size="28" font-weight="700"
        font-family="Inter, sans-serif" fill="#0F0F14">${Math.round(accuracy * 100)}%</text>
      <text x="80" y="96" text-anchor="middle" font-size="10"
        font-family="Inter, sans-serif" fill="#6B7280" letter-spacing="0.15em">ACCURACY</text>
    </svg>
  `;
}

// ----- Aggregation helpers -----

function bucketSessionsByDay(sessions: AuditSessionSummary[], days: number): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    out.push({ day: d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), count: 0 });
  }
  for (const s of sessions) {
    const d = new Date(s.createdAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
    if (diff < 0 || diff >= days) continue;
    const idx = days - 1 - diff;
    if (out[idx]) out[idx]!.count++;
  }
  return out;
}

function breakdownEvents(events: AuditEvent[]): { event: string; count: number; color: string }[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.event, (counts.get(e.event) ?? 0) + 1);
  const palette = ['#0F0F14', '#3182CE', '#ECC94B', '#38A169', '#E53E3E', '#9333ea', '#0891b2', '#f97316'];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([event, count], i) => ({ event, count, color: palette[i % palette.length] ?? '#0F0F14' }));
}

function topQuizzesByPlayers(sessions: AuditSessionSummary[], n: number): { name: string; players: number; sessions: number }[] {
  const map = new Map<string, { name: string; players: number; sessions: number }>();
  for (const s of sessions) {
    const key = s.quizId ?? s.quizName ?? '—';
    const cur = map.get(key) ?? { name: s.quizName ?? 'Untitled quiz', players: 0, sessions: 0 };
    cur.players += s.joinedPlayerCount;
    cur.sessions += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.players - a.players).slice(0, n);
}

function eventKind(event: string): string {
  if (event.startsWith('quiz')) return 'quiz';
  if (event.startsWith('player')) return 'player';
  if (event.startsWith('session')) return 'session';
  return 'other';
}

function prettyEventName(event: string): string {
  // session.question_advanced → Question advanced
  const part = event.split('.').pop() ?? event;
  const spaced = part.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ----- Formatting -----

function numberFormat(n: number): string {
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeOffset(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  const abs = Math.abs(Math.round(ms / 1000));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCode(code: string): string {
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function stateBadgeHtml(state: string): string {
  const map: Record<string, { label: string; cls: string }> = {
    lobby: { label: 'Lobby', cls: 'audit-badge-blue' },
    question: { label: 'In play', cls: 'audit-badge-yellow' },
    reveal: { label: 'Reveal', cls: 'audit-badge-yellow' },
    leaderboard: { label: 'Leaderboard', cls: 'audit-badge-yellow' },
    final: { label: 'Final', cls: 'audit-badge-green' },
    ended: { label: 'Ended', cls: 'audit-badge-mute' },
  };
  const m = map[state] ?? { label: state, cls: 'audit-badge-mute' };
  return `<span class="audit-badge ${m.cls}">${escapeHtml(m.label)}</span>`;
}

// ----- Print / PDF -----

function printBranding(): string {
  // Visible only in print mode. Anchored bottom of every page via
  // position:fixed + @page rules in CSS so it repeats across pages.
  return `
    <div class="audit-print-brand" aria-hidden="true">
      <img src="/moliam-logo.png" alt="moliam" class="audit-print-brand-logo" />
      <div class="audit-print-brand-text">
        <div class="audit-print-brand-name">moliam</div>
        <div class="audit-print-brand-url">clutch.moliam.com</div>
      </div>
      <div class="audit-print-brand-tag">Internal · Class review</div>
    </div>
  `;
}

function moliamFooterMark(): string {
  return `
    <a href="https://moliam.com/" rel="noopener" class="audit-footer-brand">
      <img src="/moliam-logo.png" alt="moliam" />
      <span>moliam</span>
    </a>
  `;
}

function triggerPdfExport(title: string): void {
  const prevTitle = document.title;
  document.title = title;
  document.body.classList.add('audit-printing');
  // Use a short timeout so any layout adjustments settle before the print dialog opens.
  window.setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      toast('Print failed: ' + (err as Error).message, 'error');
    }
    document.body.classList.remove('audit-printing');
    document.title = prevTitle;
  }, 60);
}

// ----- Icons -----

function backArrowSvg(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`;
}
function refreshSvg(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;
}
function pdfSvg(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 14h6"/><path d="M9 18h6"/></svg>`;
}
function iconSessions(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/></svg>`;
}
function iconPlayers(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3.5"/><path d="M2.5 19c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><circle cx="17" cy="8" r="2.5"/><path d="M15 13.6c2.4 0.4 4.2 2 5 4.4"/></svg>`;
}
function iconAnswers(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L3 21l1.9-5.6c-.6-1.2-.9-2.5-.9-3.9A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`;
}
function iconAccuracy(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/></svg>`;
}
function iconClock(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
}

// ----- Utilities -----

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
