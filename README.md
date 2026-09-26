# ⧗ Hourglass

A private, single-user web app for logging how every hour of your day is spent, reflecting on it,
and staying honest over the long term. **Once something is logged it can never be edited or
deleted, only added to.** You can append notes, but you can't change what you logged.

- Client: React + Vite, React Router, Chart.js, vanilla CSS (dark glassmorphism, mobile first), installable PWA
- Server: Node.js + Express + Mongoose, MongoDB (local or Atlas)
- Day boundaries use `Asia/Kolkata` (`APP_TZ`), decided by the server's clock, never the device's.

See [`CLAUDE.md`](CLAUDE.md) for the project principles and [`docs/PLAN.md`](docs/PLAN.md) for the
full design (schemas and API routes).

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup, auth, categories, 24-hour logging grid (locking, notes, late window, timezone) | ✅ done |
| 2 | Dashboard & goals, plan vs actual, calendar, Stop Doing list | ✅ done |
| 3 | End-of-day reflection, weekly review, letters to future self | ✅ done |
| 4 | Analytics, export, backup script, PWA | ✅ done |

## Requirements

- Node.js 20+
- A MongoDB database, one of:
  - **Nothing to install:** `npm run db` starts a local MongoDB for development (works in GitHub
    Codespaces). The first run downloads it (~100 MB), and data is kept in `.mongo-data/`.
  - MongoDB 6+ installed locally on `mongodb://localhost:27017`
  - A MongoDB Atlas connection string in `server/.env`

## Setup

```bash
# 1. Install dependencies for both apps
npm run install:all

# 2. Create server/.env and set your password (hashes it with bcrypt, creates JWT_SECRET)
cp server/.env.example server/.env
npm run set-password
#    Edit server/.env if you use Atlas: MONGODB_URI=mongodb+srv://...

# 3. (optional) client/.env, only if the API isn't on localhost:4000
cp client/.env.example client/.env
```

### server/.env

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/timelog` | Local or Atlas URI |
| `APP_TZ` | `Asia/Kolkata` | Time zone for "today" and hour blocks |
| `LOG_WINDOW_HOURS` | `12` | How long after an hour ends it can still be logged |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Only origin allowed by CORS |
| `COOKIE_SECURE` | `false` (`true` in production) | Send the session cookie only over HTTPS |
| `PASSWORD_HASH` | — | bcrypt hash, set by `npm run set-password` |
| `JWT_SECRET` | — | Created by `npm run set-password` if missing |

Changing the password with `npm run set-password` logs out every existing session.

## Run (development)

Three terminals (skip the first if you already run MongoDB or use Atlas):

```bash
npm run db           # local MongoDB on 127.0.0.1:27017 (keep it running)
npm run dev:server   # API on http://localhost:4000 (auto-restarts)
npm run dev:client   # UI on http://localhost:5173 (proxies /api to the server)
```

If the server says **"Could not connect to MongoDB"** (or Vite logs `http proxy error … ECONNREFUSED`),
the database isn't running. Start `npm run db`, then save any server file (or restart
`dev:server`) and it reconnects.

**GitHub Codespaces:** the same three commands work. Open the forwarded port **5173** from the
*Ports* tab. Only 5173 needs to be opened, because the API is reached through Vite's proxy.

Open http://localhost:5173 and log in. To use it from your phone on the same Wi-Fi, open
`http://<your-computer-ip>:5173` and set `CLIENT_ORIGIN` to that address.

On first start the server seeds default categories: Deep work, Study, Exercise, Sleep, Social,
Entertainment, Chores.

## Run (production)

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built client on PORT
```

Serve it over HTTPS (reverse proxy) so the session cookie is `Secure`.

## Install on your phone (PWA)

The app is a Progressive Web App (manifest, icons, and a service worker that caches the app shell).
Browsers only allow installing, and only run the service worker, on **HTTPS** (or `localhost`), so:

1. Run it in production mode (`npm run build && npm start`) behind HTTPS. Options: a reverse proxy
   with a certificate (Caddy, nginx), a host like Render or Railway, or a tunnel (Cloudflare Tunnel,
   Tailscale Funnel). Set `CLIENT_ORIGIN` to that URL and `COOKIE_SECURE=true`.
2. Open the URL on your phone. **Android/Chrome**: menu → *Install app*. **iPhone/Safari**: Share →
   *Add to Home Screen*.

Offline, the installed app still opens and says you're offline. Logging needs the server's clock,
so it only works online. Your hours stay open for the logging window, so nothing is lost.
API responses are never cached.

## Backups & export

```bash
npm run backup     # mongodump → backups/YYYY-MM-DD_HH-mm-ss/ (timestamp in APP_TZ)
```

Needs [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/installation/)
(`mongodump`) on your PATH. It works with local MongoDB and with Atlas (it uses `MONGODB_URI`).
A backup contains everything, including sealed letters. To restore it:

```bash
mongorestore --uri="$MONGODB_URI" backups/<folder>
```

In the app, **More → Export** downloads:
- **JSON** of everything. Sealed letters are included without their text until they open.
- **CSV** of all logged hours (one row per hour, with notes). Cells are protected against
  spreadsheet formula injection.

## Tests

```bash
npm test
```

Jest + Supertest against an in-memory MongoDB (`mongodb-memory-server`, which downloads a
`mongod` binary on first run). If that download is blocked, point it at an existing binary:

```bash
MONGOMS_SYSTEM_BINARY=/path/to/mongod npm test
```

Tests freeze the server clock at specific Asia/Kolkata times to check the time rules exactly.

## How logging works

| Hour state | Meaning |
|---|---|
| **Future** | The hour hasn't finished yet, including the hour in progress. It can't be logged. |
| **Open** | It has ended and it's within `LOG_WINDOW_HOURS` of its end. You can log it once, and then it's locked. |
| **Logged** | It's locked forever. The only change allowed is appending timestamped notes. The server records when it was logged and how late. |
| **Unaccounted** | It wasn't logged before the window closed. It stays unaccounted permanently. |

Hours from yesterday that are still inside the window appear under "Still open from yesterday".

### Definitions

- **Alignment %** = hours logged "toward goal" ÷ hours logged.
- **Plan adherence %** = planned hours done in the planned category ÷ planned hours already decided
  (logged or unaccounted). An unaccounted planned hour counts as a miss.
- **Streak** = consecutive days with zero unaccounted hours. Today counts while it has none so far.
  Tracking starts on the day of your first logged hour; earlier days are "untracked".
- **Plans** can be made for today and tomorrow. Every change is a new revision, and the latest one
  wins. An hour's plan locks when the hour starts.
- **Stop Doing**: items can be resolved (one-way) but never deleted. Linking a logged hour to an item
  records a relapse, including relapses after the item was resolved, which are flagged.
- **Reflections**: one per day, for today, or for yesterday until `LOG_WINDOW_HOURS` after midnight.
  Locked once saved; notes can be appended.
- **Letters** unlock at 00:00 APP_TZ on their unlock date, which must be after today. Until then the
  API returns only the title and dates; the body is excluded at the schema level (`select: false`).
  Letters can never be edited or deleted.
- **Weekly review** covers Monday–Sunday.

## API

Every route except `/api/auth/*` requires the session cookie. **Every `PUT`/`PATCH`/`DELETE`
returns 405**, because there are no edit or delete endpoints.

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | Log in with `{ password }`. Limited to 5 attempts per 15 minutes. |
| `POST /api/auth/logout`, `GET /api/auth/me` | Log out / check the session |
| `GET /api/meta/now` | The server's current time, today's date, time zone and log window |
| `GET /api/categories[?includeArchived=1]` | List categories |
| `POST /api/categories` | Create a category with `{ name, color }` (append-only) |
| `POST /api/categories/:id/archive` / `unarchive` | The only change a category allows |
| `GET /api/days/:date` | The 24 hours of a day, each with its status, plus a day summary |
| `GET /api/days/open` | Every hour that can still be logged right now |
| `POST /api/blocks` | Log an open hour with `{ date, hour, activity, category, energy, alignment, stopDoingItem? }` |
| `GET /api/blocks/:id` | A single block |
| `POST /api/blocks/:id/notes` | Append a note with `{ text }` |
| `GET /api/dashboard` | Latest goal and statement, today's summary and the streak |
| `GET /api/goals` · `POST /api/goals` | Goal and contribution history; add a version with `{ kind: goal\|contribution, text }` |
| `GET /api/plans/:date` | Each hour's current plan, its revision history and whether it's locked |
| `POST /api/plans` · `POST /api/plans/bulk` | Add plan revisions for today or tomorrow: `{ date, hour \| hours[], activity, category }` or `{ …, cleared: true }` |
| `GET /api/calendar?month=YYYY-MM` | Per day: hours logged, unaccounted hours, dominant category, alignment % |
| `GET /api/stop-doing` · `GET /api/stop-doing/:id` | Items with relapse counts / one item with its relapse timeline |
| `POST /api/stop-doing` · `POST /api/stop-doing/:id/resolve` | Add an item / resolve it (one-way) |
| `GET /api/reflections/open` | The dates you can still write a reflection for, and whether each is written |
| `GET /api/reflections?from&to` · `GET /api/reflections/:date` | Reflections in a date range / for one date |
| `POST /api/reflections` · `POST /api/reflections/:date/notes` | Write one with `{ date, wentWell, didntGoWell, changeTomorrow }` / append a note |
| `GET /api/reviews/week?start=YYYY-MM-DD` | Weekly review for the week containing `start`: totals, categories, each day, relapses, reflections |
| `GET /api/letters` · `GET /api/letters/:id` | Titles and dates only; the body appears on `/:id` only once the letter is unlocked |
| `POST /api/letters` | Seal a letter with `{ title, body, unlockDate }` |
| `GET /api/analytics/categories?period=day\|week\|month&from&to` | Hours per category per bucket, with empty buckets filled in |
| `GET /api/analytics/heatmap?year=YYYY` | Hours logged, alignment % and unaccounted hours for every day of the year |
| `GET /api/analytics/energy-by-hour?from&to` | Average energy for each hour of the day (default: last 90 days) |
| `GET /api/analytics/sleep?from&to` | Per night (noon to noon): hours asleep, bedtime and wake time from the Sleep category |
| `GET /api/analytics/week-compare?a&b` | Hours per category for week A vs week B (default: this week vs last week) |
| `GET /api/analytics/streaks` | Current and longest streak |
| `GET /api/export/json` · `GET /api/export/blocks.csv` | Downloads |
