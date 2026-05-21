# Clutch

A self-hosted, Kahoot-style quiz game for small groups. Built for a ~30-person
work AI club, but it works anywhere you've got a laptop, a projector, and some
phones.

- **No accounts.** No password. You host, you share a QR code, everybody plays.
- **No cloud.** One Node process, one SQLite file. Runs on your laptop.
- **No AI.** Just Excel in, quiz out.

---

## Stack

Single flat `package.json` (not workspaces — fewer moving parts for a personal
project). Server: Node 20 + Express + Socket.IO + better-sqlite3. Client:
vanilla TypeScript + Vite + Tailwind. Zod is the single source of truth for
all payloads; schemas live in `shared/` and import into both sides.

```
server/       Express + Socket.IO + SQLite
client/       Vite + TS + Tailwind single-page app
shared/       Zod schemas + event/constant definitions
tests/        Vitest — pure logic only
```

---

## Setup (Windows, PowerShell)

```powershell
# 1. Install deps
npm install

# 2. (Optional) Copy the env template. You only need to edit this if the
#    auto-detected LAN IP picks the wrong network adapter (VPN, WSL, etc.).
copy .env.example .env

# 3. Seed the database with an example quiz
npm run seed

# 4a. Development — server + Vite dev server in one terminal, hot-reload
npm run dev
#   → open http://localhost:5173

# 4b. OR production build — builds the client into server/public, compiles
#     the server, runs everything on a single port (default 3000)
npm run build
npm start
#   → open http://localhost:3000
```

On startup the server prints both URLs:

```
  Clutch is ready.

    Local:   http://localhost:3000
    Network: http://192.168.1.50:3000
```

**Players use the Network URL** — their phones can't reach `localhost`. The
host QR code is built from this address.

If the auto-detected IP is wrong (VPN, multiple NICs, Docker/WSL adapter
picked instead of Wi-Fi), set it explicitly in `.env`:

```
PUBLIC_HOST=http://192.168.1.50:3000
```

---

## Hosting a game

1. Upload an Excel file (or click **Host** on a saved quiz).
2. The host screen shows a giant QR code + session code (e.g. `QZ7X-4K`).
3. Players scan the QR, type a name, and land in the lobby.
4. Host presses **Start game**.
5. Each question has **20 seconds**. The server is authoritative on timing.
6. Between questions, the host sees a leaderboard and presses **Next**.
7. Final podium shows the top 3 with a bar-rise animation.

Phones show only colored shape tiles — **no question text or answer labels**.
The whole point is to make people look at the host screen. This is intentional,
not a bug.

---

## Excel template format

Row 1 is a header (skipped). Each row = one question.

| Column | Meaning          |
|:-------|:-----------------|
| A      | Question text    |
| B      | Correct answer   |
| C      | Wrong answer 1   |
| D      | Wrong answer 2   |
| E      | Wrong answer 3   |

Example:

| Question                                    | Correct | Wrong 1 | Wrong 2 | Wrong 3 |
|:--------------------------------------------|:--------|:--------|:--------|:--------|
| What year did the first moon landing occur? | 1969    | 1965    | 1972    | 1959    |
| Which planet is known as the Red Planet?    | Mars    | Venus   | Jupiter | Mercury |

**Rules:**

- `.xlsx`, `.xls`, or `.csv`, up to 2 MB, up to 100 questions.
- Every row must have all 4 answer cells non-empty.
- No duplicate answers within a row (case-insensitive).
- The correct-answer position is **randomized per question** when the quiz is
  saved — column B being always-correct does not leak to players.
- On any validation error the **whole file is rejected** with a row-level
  reason. No partial imports.

Download a pre-filled template at `/api/quizzes/template` (or `/api/template`)
or through the **Download template** link on the home page. Run
`npm run build:template` to generate one into `server/public/`.

---

## npm scripts

| Command             | What it does                                                    |
|:--------------------|:----------------------------------------------------------------|
| `npm run dev`       | Server + Vite dev server, concurrent, one terminal, hot-reload. |
| `npm run build`     | Builds the client into `server/public/`, compiles the server.   |
| `npm start`         | Runs the built server on a single port, serves the built client.|
| `npm run seed`      | Inserts an example quiz into `data/quiz.db`.                    |
| `npm test`          | Runs Vitest once (no watch).                                    |
| `npm run typecheck` | Type-checks server and client.                                  |

All scripts are Windows-safe — no bash-isms, no symlinks, no shell redirects.

---

## Architecture notes

### Timing

The server stores `startedAt` + `pauseAccumMs` per session. Clients compute
remaining time from `Date.now()` against the deadline — **no per-second tick
messages on the wire**. This keeps the socket quiet and avoids drift.

Late submissions (past the deadline + 1 s grace) are rejected.

Pause freezes the server-side deadline; resume shifts it forward by however
long the pause lasted. Multiple pauses accumulate cleanly.

### Late joiners

A player who joins mid-question is added to the roster but marked locked-out
for the current question. Their phone shows "Joining next round…". At the next
`question_start`, the lockout clears automatically.

### Session codes

6 chars from a 31-char alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no 0, O,
1, I, L). That's ~887 million codes. We retry up to 5 times on collision.

### Data persistence

Quizzes, sessions (shell), and final results are persisted in SQLite. **Live
per-player state (scoreboard, which answer they picked) lives in memory only.**
A server restart loses any in-progress game. This is fine for a 30-person
personal project. Don't run this for anything that matters.

### Scoring

```
correct:  round(1000 * (1 - elapsedMs / 20000 / 2))
wrong:    0
```

Fastest correct ≈ 1000, slowest correct = 500.

---

## Endpoints

| Method | Path                                | Purpose                                      |
|:-------|:------------------------------------|:---------------------------------------------|
| GET    | `/healthz`                          | `{ ok, uptime, activeSessions }`             |
| GET    | `/api/quizzes`                      | List saved quizzes                           |
| GET    | `/api/quizzes/:id`                  | One quiz with questions                      |
| POST   | `/api/quizzes/upload`               | Upload Excel, returns parsed review          |
| POST   | `/api/quizzes`                      | Save a reviewed quiz                         |
| DELETE | `/api/quizzes/:id`                  | Delete a quiz                                |
| GET    | `/api/quizzes/template`             | Download blank template.xlsx                 |
| GET    | `/api/template`                     | Alias → template                             |
| GET    | `/api/sessions/:code`               | Look up a session by 6-char code             |
| GET    | `/api/sessions/by-id/:id`           | Look up a session by UUID (host use)         |
| GET    | `/api/sessions/:id/results`         | Final leaderboard for a finished session     |

Rate limit: `POST /api/quizzes/upload` is capped at 10 requests per minute
per IP.

### Socket events

See `shared/events.ts` for the canonical list. Every client → server payload
is validated with Zod and rejected with an ack describing why.

---

## Environment variables

All optional — the app runs fine with no `.env` at all. Copy `.env.example`
to `.env` to customize.

| Var            | Default           | Purpose                                           |
|:---------------|:------------------|:--------------------------------------------------|
| `PORT`         | `3000`            | HTTP port.                                        |
| `PUBLIC_HOST`  | *(auto-detected)* | URL or host[:port] players use. Overrides LAN auto-detection. Set this if your LAN IP comes out wrong. |
| `NODE_ENV`     | `development`     | Set to `production` for prod mode.                |
| `DB_PATH`      | `./data/quiz.db`  | SQLite file location.                             |
| `HOST`         | `0.0.0.0`         | Bind address.                                     |

---

## Tests

```powershell
npm test
```

Tests cover:

- Scoring math (fast/slow/wrong/clamped)
- Session code generator (alphabet, length, uniqueness at scale)
- Excel parser (valid + every way it can fail)
- Timer pause/resume and grace window
- Answer validator (state, pause, wrong index, late joiner, duplicate, late)
- Name uniqueness (case-insensitive)

No UI tests. The UI is simple enough to eyeball.

---

## Known limitations

- **Live game state is in-memory only.** A server restart ends every active
  game. Final results from finished games are preserved in SQLite.
- **No auth whatsoever.** Anyone with the host URL UUID can control the game.
  Anyone with the 6-char code and a free name can play. UUIDs are unguessable
  in practice.
- **Tested up to ~30 players.** Socket.IO and SQLite can handle much more —
  this is just the claim we're willing to make.
- **No spectator mode.** If two people open the same `/host/:id` URL they
  both see the host view and both can press buttons. First-come, first-served.
- **Host refresh is survivable** (the UUID in the URL and the code in
  sessionStorage let the page rebuild itself). **Player refresh** rejoins
  automatically using the cached name + code.
- **No internationalization.** The UI is English-only.

---

## License

MIT. Use it, fork it, host your own.
