# ⧗ Hourglass

A private, single-user web app for logging how every hour of your day is spent, reflecting on it,
and staying honest over the long term. **Once something is logged it can never be edited or
deleted, only added to.** You can append notes, but you can't change what you logged.

- Client: React + Vite, React Router, vanilla CSS (dark glassmorphism, mobile first)
- Server: Node.js + Express + Mongoose, MongoDB (local or Atlas)
- Day boundaries use `Asia/Kolkata` (`APP_TZ`), decided by the server's clock, never the device's.

See [`CLAUDE.md`](CLAUDE.md) for the project principles and [`docs/PLAN.md`](docs/PLAN.md) for the
full design (schemas and API routes).

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup, auth, categories, 24-hour logging grid (locking, notes, late window, timezone) | ✅ done |
| 2 | Dashboard & goals, plan vs actual, calendar, Stop Doing list | ⏳ next |
| 3 | End-of-day reflection, weekly review, letters to future self | — |
| 4 | Analytics, export, backup script, PWA | — |

## Requirements

- Node.js 20+
- MongoDB 6+ running locally on `mongodb://localhost:27017`, **or** a MongoDB Atlas connection string

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

Two terminals:

```bash
npm run dev:server   # API on http://localhost:4000 (auto-restarts)
npm run dev:client   # UI on http://localhost:5173 (proxies /api to the server)
```

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

## API (Phase 1)

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
