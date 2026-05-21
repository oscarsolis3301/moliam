import type { Server, Socket } from 'socket.io';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../../../shared/events.js';
import {
  HostCreateSessionSchema,
  HostRotateSessionSchema,
  HostSessionActionSchema,
  PlayerAnswerSchema,
  PlayerJoinSchema,
  PlayerThrowSchema,
  type StartCountdownPayload,
} from '../../../shared/schemas.js';
import { GameEngine } from '../game/engine.js';
import { logger } from '../lib/logger.js';
import { extractActorFromHeaders } from '../lib/actor.js';
import { publicHostUrlFromHeaders } from '../lib/public-host.js';

// Total duration of the host's "3, 2, 1, GO!" overlay before the first
// question fires. Lives on the server so the host UI and player overlays
// share an authoritative clock.
const START_COUNTDOWN_MS = 3200;

export function attachSocketHandlers(io: Server, engine: GameEngine): void {
  io.on('connection', (socket: Socket) => {
    // The actor is captured from the original HTTP handshake headers — Socket.IO
    // exposes them on `socket.handshake.headers`. This works whether traffic
    // comes from the FastAPI harness (which forwards `x-user-email`) or a
    // direct browser connection (which falls back to "local").
    const actor = extractActorFromHeaders(socket.handshake.headers);
    // Public-facing URL the host's browser used. Used to build the QR code
    // and "Join at …" line so they reflect the real domain (e.g.
    // clutch.moliam.com) instead of the server's LAN IP.
    const publicHostUrl = publicHostUrlFromHeaders(socket.handshake.headers);
    socket.data.actor = actor;
    logger.debug({ socketId: socket.id, actor, publicHostUrl }, 'socket connected');

    // ----- Host -----

    socket.on(CLIENT_EVENTS.HostCreateSession, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = HostCreateSessionSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ ok: false, reason: 'Invalid payload' });
        return;
      }
      try {
        const { sessionId, code } = engine.createSession(parsed.data.quizId, actor);
        engine.registerHostSocket(sessionId, socket.id);
        void socket.join(`session:${sessionId}`);
        void socket.join(`session:${sessionId}:host`);
        if (ack) ack({ ok: true, sessionId, code, publicHostUrl });
      } catch (err) {
        logger.error({ err }, 'createSession failed');
        if (ack) ack({ ok: false, reason: (err as Error).message });
      }
    });

    socket.on(CLIENT_EVENTS.HostJoinRoom, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = HostSessionActionSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ ok: false, reason: 'Invalid payload' });
        return;
      }
      const registered = engine.registerHostSocket(parsed.data.sessionId, socket.id);
      if (!registered) {
        if (ack) ack({ ok: false, reason: 'Session not found' });
        return;
      }
      void socket.join(`session:${parsed.data.sessionId}`);
      void socket.join(`session:${parsed.data.sessionId}:host`);
      // Echo the current session state so the host UI can render the correct
      // view on (re)load instead of defaulting to a fresh lobby. Without this,
      // a host tab for a session that already ran to completion would show
      // a Start button that the engine will correctly refuse.
      const sess = engine.getBySessionId(parsed.data.sessionId);
      if (ack) ack({
        ok: true,
        publicHostUrl,
        state: sess?.state ?? 'lobby',
      });
    });

    const hostAction = (evt: string, fn: (id: string, actor: string) => void) => {
      socket.on(evt, (payload: unknown, ack?: (res: unknown) => void) => {
        const parsed = HostSessionActionSchema.safeParse(payload);
        if (!parsed.success) {
          if (ack) ack({ ok: false, reason: 'Invalid payload' });
          return;
        }
        try {
          fn(parsed.data.sessionId, actor);
          if (ack) ack({ ok: true });
        } catch (err) {
          logger.error({ err, evt }, 'host action failed');
          if (ack) ack({ ok: false, reason: (err as Error).message });
        }
      });
    };

    hostAction(CLIENT_EVENTS.HostStartGame, (id, a) => engine.startGame(id, a));

    // Broadcast the pre-game countdown to every connected player so phones
    // see the room lighting up in real time. We don't transition state here
    // — `host:start_game` follows once the host's local countdown finishes.
    socket.on(CLIENT_EVENTS.HostStartCountdown, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = HostSessionActionSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ ok: false, reason: 'Invalid payload' });
        return;
      }
      const sess = engine.getBySessionId(parsed.data.sessionId);
      if (!sess) {
        if (ack) ack({ ok: false, reason: 'Session not found' });
        return;
      }
      const room = `session:${parsed.data.sessionId}`;
      const out: StartCountdownPayload = {
        deadline: Date.now() + START_COUNTDOWN_MS,
        durationMs: START_COUNTDOWN_MS,
      };
      io.to(room).emit(SERVER_EVENTS.StartCountdown, out);
      if (ack) ack({ ok: true });
    });
    hostAction(CLIENT_EVENTS.HostPause, (id, a) => engine.pause(id, a));
    hostAction(CLIENT_EVENTS.HostResume, (id, a) => engine.resume(id, a));
    hostAction(CLIENT_EVENTS.HostSkip, (id, a) => engine.skipQuestion(id, a));
    hostAction(CLIENT_EVENTS.HostNext, (id, a) => engine.nextQuestion(id, a));
    hostAction(CLIENT_EVENTS.HostEnd, (id, a) => engine.endGame(id, a));

    // Rotate session: keep the connected players, swap to a fresh quiz/game.
    // This is two steps: (1) engine state migration; (2) physically move every
    // socket between socket.io rooms so subsequent broadcasts hit the right
    // listeners. The engine emits SessionReplaced *before* we re-room so the
    // client can update its sessionId; we then change the rooms and emit a
    // RosterUpdate on the new room.
    socket.on(CLIENT_EVENTS.HostRotateSession, async (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = HostRotateSessionSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ ok: false, reason: 'Invalid payload' });
        return;
      }
      try {
        // Snapshot the sockets currently in the OLD session room before the
        // engine swap, so we know exactly which sockets to migrate.
        const oldRoom = `session:${parsed.data.sessionId}`;
        const oldHostRoom = `session:${parsed.data.sessionId}:host`;
        const allSocketsInRoom = await io.in(oldRoom).fetchSockets();
        const hostSocketsInRoom = await io.in(oldHostRoom).fetchSockets();
        const hostSocketIdSet = new Set(hostSocketsInRoom.map((s) => s.id));

        const created = engine.rotateSession({
          oldSessionId: parsed.data.sessionId,
          quizId: parsed.data.quizId,
          actor,
        });

        const newRoom = `session:${created.sessionId}`;
        const newHostRoom = `session:${created.sessionId}:host`;

        for (const remote of allSocketsInRoom) {
          remote.leave(oldRoom);
          remote.join(newRoom);
          if (hostSocketIdSet.has(remote.id)) {
            remote.leave(oldHostRoom);
            remote.join(newHostRoom);
          }
        }

        if (ack) ack({ ok: true, sessionId: created.sessionId, code: created.code, publicHostUrl });
      } catch (err) {
        logger.error({ err }, 'rotate_session failed');
        if (ack) ack({ ok: false, reason: (err as Error).message });
      }
    });

    // ----- Player -----

    socket.on(CLIENT_EVENTS.PlayerJoin, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = PlayerJoinSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ ok: false, reason: 'Invalid name or code.' });
        return;
      }
      const result = engine.joinByCode({
        code: parsed.data.code,
        name: parsed.data.name,
        socketId: socket.id,
        actor,
      });
      if (!result.ok) {
        if (ack) ack({ ok: false, reason: result.reason });
        return;
      }
      const s = engine.getBySessionId(result.sessionId);
      if (!s) {
        if (ack) ack({ ok: false, reason: 'Session vanished.' });
        return;
      }
      void socket.join(`session:${s.id}`);
      if (ack) {
        ack({
          ok: true,
          playerId: result.playerId,
          sessionId: s.id,
          sessionCode: s.code,
          currentState: s.state,
          currentQuestionIndex: s.currentQuestionIndex,
          totalQuestions: s.quiz.questions.length,
          lateForCurrent: result.lateForCurrent,
        });
      }
    });

    socket.on(CLIENT_EVENTS.PlayerAnswer, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = PlayerAnswerSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ accepted: false, reason: 'Invalid payload' });
        return;
      }
      const result = engine.submitAnswer({
        socketId: socket.id,
        sessionId: parsed.data.sessionId,
        questionIndex: parsed.data.questionIndex,
        choiceIndex: parsed.data.choiceIndex,
        actor,
      });
      if (!result.accepted) {
        logger.info(
          { socketId: socket.id, sessionId: parsed.data.sessionId, reason: result.reason },
          'answer rejected',
        );
      }
      if (ack) ack(result);
    });

    socket.on(CLIENT_EVENTS.PlayerThrow, (payload: unknown, ack?: (res: unknown) => void) => {
      const parsed = PlayerThrowSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ accepted: false, reason: 'Invalid throw' });
        return;
      }
      const result = engine.submitThrow({
        socketId: socket.id,
        sessionId: parsed.data.sessionId,
        questionIndex: parsed.data.questionIndex,
        kind: parsed.data.kind,
        x: parsed.data.x,
        y: parsed.data.y,
        vx: parsed.data.vx,
        vy: parsed.data.vy,
        originSide: parsed.data.originSide,
      });
      if (ack) ack(result);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected');
      engine.detachSocket(socket.id);
    });
  });

  logger.info('socket handlers attached');
  // Swallow unused import warning in compilers that nag
  void SERVER_EVENTS;
}
