# Hourglass — personal time logging & reflection app

Private, single-user web app for logging every hour of the day, reflecting on it, and staying
honest long term. The defining idea is **permanence**: logged data is never edited or deleted,
only added to.

## Core principles (apply to every feature and every change)

1. **Permanence.** Logged data is never edited or deleted. Collections are append-only unless a
   feature explicitly allows a state change (category archive/unarchive, Stop Doing
   active→resolved, plan revisions before the hour starts). "Changes" are new appended entries
   (e.g. timestamped notes).
2. **Enforce on the server.** Every rule lives in routes *and* in Mongoose schemas/middleware,
   never only in the UI.
   - `server/src/lib/immutable.js` is a Mongoose plugin every permanent model must use. It rejects
     deletes/replaces and any update outside the model's whitelisted `mutable` / `appendOnly` paths.
   - `server/src/app.js` refuses every `PUT`/`PATCH`/`DELETE` under `/api` with 405. Do not add
     edit or delete endpoints; state changes are `POST /resource/:id/<action>`.
   - Mark locked schema fields `immutable: true` as a second layer.
3. **Honesty.** Make it hard to fake or reconstruct data after the fact. Server sets all
   timestamps (`createdAt`, `loggedAt`, note times, `lateMinutes`); client-supplied values for them
   are ignored. Late logging is recorded, not hidden.
4. **Timezone.** All day boundaries and hour blocks use `APP_TZ` (Asia/Kolkata) via
   `server/src/lib/time.js` (Luxon). Never use server-local time, UTC or the device clock to decide
   "today". Dates are stored as `YYYY-MM-DD` strings in APP_TZ plus UTC instants. The client gets
   "now/today" from `GET /api/meta/now`.
5. **No AI features yet.** Keep data clean and well-structured so an AI reflection feature can be
   added later. The Analytics page keeps an empty "Reflection insights" placeholder.

## Domain rules

- Hour status (`time.hourStatus`): `future` (not ended, includes the hour in progress) → `open`
  (ended, within `LOG_WINDOW_HOURS`, default 12) → `unaccounted` (window closed, permanent), or
  `logged`. Unaccounted is derived, never stored.
- Time blocks: unique per (date, hour), locked on create, only `$push notes`.
- Categories: name/colour immutable; archive/unarchive only; archived can't be used for new
  logs/plans; seeded defaults on first run.
- Alignment % = toward-goal hours ÷ logged hours. Weeks start Monday. Streak = consecutive days with
  zero unaccounted hours.
- Plans: append-only revisions for today/tomorrow; rejected once the hour starts; adherence =
  planned hours whose actual category matches ÷ planned hours that have passed.
- Reflections: one per date (today, or yesterday within the log window), locked, notes only.
- Letters: fully immutable; the body is never returned (list, detail, export) before `unlocksAt`
  (00:00 APP_TZ on the unlock date, which must be after today).
- Stop Doing: add, resolve (one-way), never delete; relapses = blocks linked to the item.

## Structure

```
CLAUDE.md, README.md, docs/PLAN.md    principles, setup, original design plan
backups/                              mongodump output (npm run backup)
server/                               Express + Mongoose API (CommonJS)
  src/app.js                          app factory (helmet, CORS, 405 guard, routers)
  src/index.js                        connect, seed, listen
  src/config.js                       env parsing
  src/lib/                            time.js, immutable.js, errors.js, validate.js
  src/middleware/auth.js              JWT in httpOnly cookie, 7 days, invalidated on password change
  src/models/                         one file per collection
  src/routes/                         one router per feature
  src/services/                       read models / aggregations (day grid, dashboard, analytics…)
  scripts/                            set-password.js, backup.js
  tests/                              Jest + Supertest + mongodb-memory-server, fake clock via setIST()
client/                               React + Vite SPA (ESM), vanilla CSS
  src/api.js                          fetch wrapper (cookies)
  src/context/                        AuthContext, ClockContext (server time)
  src/components/, src/pages/         UI; mobile first
  src/styles/theme.css                dark glassmorphism tokens + components
```

## Working conventions

- Every new permanence rule needs a server test (API level **and** model level where relevant).
  Time rules are tested by freezing the clock with `setIST('YYYY-MM-DDTHH:mm')`.
- Run `npm test` in `server/`. If MongoDB binaries can't be downloaded, set
  `MONGOMS_SYSTEM_BINARY=/path/to/mongod`.
- Keep UI consistent (glass cards, `.stats`, `.hour-grid`, `.cat-chip`, `.btn`) and usable at
  ~375px width. The client never computes "today" itself.
