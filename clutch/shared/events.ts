// Socket event name constants. Used both sides to avoid string typos.

export const CLIENT_EVENTS = {
  HostCreateSession: 'host:create_session',
  HostStartGame: 'host:start_game',
  HostPause: 'host:pause',
  HostResume: 'host:resume',
  HostSkip: 'host:skip_question',
  HostNext: 'host:next_question',
  HostEnd: 'host:end_game',
  HostJoinRoom: 'host:join_room',
  // Tell the server "the host clicked Start; broadcast a 3-2-1-GO countdown to
  // every connected player so they see the room lighting up in real time."
  // We keep this distinct from HostStartGame because the host runs its own
  // countdown UI locally (already wired to its audio cues) and the engine
  // only spins up the first question after the countdown completes.
  HostStartCountdown: 'host:start_countdown',
  // Recreate the lobby with the same connected players. The host picks a new
  // (or the same) quiz; the engine spins up a fresh session, migrates every
  // active player socket into it, and tells everyone via SessionReplaced.
  HostRotateSession: 'host:rotate_session',
  PlayerJoin: 'player:join',
  PlayerAnswer: 'player:answer',
  // Player-thrown projectile (tomato, paper plane, etc.) flung at the host
  // screen during the waiting window after they've already answered. The
  // server gates these on state + ammo + cooldown and re-broadcasts to the
  // host as `ProjectileThrown` for rendering.
  PlayerThrow: 'player:throw',
} as const;

export const SERVER_EVENTS = {
  StateUpdate: 'state_update',
  RosterUpdate: 'roster_update',
  QuestionStart: 'question_start',
  QuestionStartHost: 'question_start_host',
  AnsweredCount: 'answered_count',
  QuestionReveal: 'question_reveal',
  Leaderboard: 'leaderboard',
  Paused: 'paused',
  Resumed: 'resumed',
  GameOver: 'game_over',
  // Sent to all players when the host rotates the room into a fresh session.
  // Players auto-migrate to the new sessionId/code without re-entering the
  // join code or their name.
  SessionReplaced: 'session_replaced',
  // Server-authoritative "the host just hit Start; show your players a
  // synchronized 3-2-1-GO overlay." Carries an absolute deadline so every
  // phone counts to the same second regardless of clock drift.
  StartCountdown: 'start_countdown',
  // Host-side fan-out of an accepted player throw. Carries the projectile
  // kind, normalized splat coords, and the thrower's name so the host can
  // animate it onto the question screen with a tasteful name pill.
  ProjectileThrown: 'projectile_thrown',
  Error: 'error',
} as const;

export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];
