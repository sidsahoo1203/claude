# Build plan — Personal Time Log (proposal, awaiting approval)

All times and day boundaries use `APP_TZ` (Asia/Kolkata) via **Luxon**. The server clock is the only
clock that decides "now"; the client asks the server for it and never trusts the device time.

## 1. Folder structure

```
/
├── CLAUDE.md                 # principles + structure for future sessions
├── README.md                 # setup, run, test, backup, deploy notes
├── docs/PLAN.md              # this file
├── backups/                  # mongodump output (git-ignored, .gitkeep)
├── server/
│   ├── package.json          # express, mongoose, luxon, bcrypt, jsonwebtoken, helmet, cors,
│   │                         # express-rate-limit, cookie-parser, dotenv; dev: jest, supertest,
│   │                         # mongodb-memory-server
│   ├── .env.example
│   ├── scripts/
│   │   ├── set-password.js   # prompts, bcrypt-hashes, writes PASSWORD_HASH into server/.env
│   │   └── backup.js         # mongodump --uri=$MONGODB_URI --out=backups/YYYY-MM-DD_HH-mm-ss
│   ├── src/
│   │   ├── index.js          # connect DB, seed, listen
│   │   ├── app.js            # express app factory (used by tests)
│   │   ├── config.js         # env parsing/validation
│   │   ├── lib/
│   │   │   ├── time.js       # IST helpers: nowIST, todayStr, hourStart(date,hour), hourStatus(), week bounds
│   │   │   ├── immutable.js  # Mongoose plugin: blocks deletes + disallowed updates at the model layer
│   │   │   └── errors.js     # HttpError + error handler
│   │   ├── middleware/       # auth (JWT cookie), rateLimit, validate
│   │   ├── models/           # one file per collection (below)
│   │   ├── services/         # dayStatus, dashboard, calendar, weekly, analytics (aggregation pipelines)
│   │   ├── routes/           # one router per feature
│   │   └── seed.js           # default categories on first run
│   └── tests/                # Jest + Supertest + in-memory MongoDB, fake clock for time rules
└── client/
    ├── package.json          # react, react-dom, react-router-dom, chart.js, react-chartjs-2
    ├── .env.example          # VITE_API_URL (optional; dev uses Vite proxy)
    ├── vite.config.js        # proxy /api -> server
    ├── public/               # manifest.webmanifest, icons (192/512/maskable), sw.js
    └── src/
        ├── main.jsx, App.jsx, api.js
        ├── context/AuthContext.jsx
        ├── components/       # Layout/Nav, HourGrid, HourCell, BlockModal, NotesThread, Timeline,
        │                     # StatCard, CategoryDot, Heatmap, Modal, EmptyState
        ├── pages/            # Login, Dashboard, Today(Log/Plan), Calendar, Day, Categories,
        │                     # StopDoing, Reflection, WeeklyReview, Letters, Analytics, Export
        └── styles/           # tokens.css (dark glass theme), base.css, per-component css
```

## 2. Mongoose schemas

Common rules: every model uses `timestamps: { createdAt: true }` set **by the server** (client-sent
`createdAt`/`loggedAt` are stripped). The `immutable` plugin hooks `deleteOne`, `deleteMany`,
`findOneAndDelete`, `findOneAndReplace`, `replaceOne` → always throw; and `updateOne/updateMany/
findOneAndUpdate/save(on existing doc)` → throw unless the update only touches the model's
whitelisted paths/operators (e.g. `$push: { notes }`). So even a buggy route can't break permanence.

| Model | Fields | Mutability |
|---|---|---|
| **Category** | `name` (unique, case-insensitive), `color` (`#rrggbb`), `archived` (bool), `archivedAt`, `createdAt` | Only `archived`/`archivedAt` may change. No delete. |
| **TimeBlock** | `date` (`YYYY-MM-DD`, IST), `hour` (0–23), `startsAt`/`endsAt` (UTC Date), `activity` (1–500 chars), `category` (ref), `energy` (1–5), `alignment` (`toward`\|`neutral`\|`against`), `stopDoingItem` (ref, optional), `loggedAt`, `lateMinutes` (how long after the hour ended it was logged), `notes: [{ text, createdAt }]` | Unique `(date,hour)`. Locked on create; only `$push notes`. |
| **PlanEntry** | `date`, `hour`, `startsAt`, `activity`, `category` (ref), `cleared` (bool), `createdAt` | Append-only **revisions**. Effective plan for an hour = latest revision. Rejected once `now ≥ startsAt`, and only for today/tomorrow. |
| **GoalEntry** | `kind` (`goal`\|`contribution`), `text`, `createdAt` | Append-only. Latest per kind is "current". |
| **StopDoingItem** | `title`, `description`, `status` (`active`\|`resolved`), `resolvedAt`, `createdAt` | Only `active → resolved` (see Q6). No delete. Relapses are derived from TimeBlocks linking to it. |
| **Reflection** | `date` (unique), `wentWell`, `didntGoWell`, `changeTomorrow`, `createdAt`, `notes: [{ text, createdAt }]` | Locked on create; only `$push notes`. |
| **Letter** | `title`, `body`, `unlockDate` (`YYYY-MM-DD`), `unlocksAt` (00:00 IST of that date, UTC Date), `createdAt` | Fully immutable. Body never leaves the server before `unlocksAt`. |

No auth collection: the password hash + JWT secret live in `server/.env`. "Unaccounted" hours are
**derived, not stored**: an hour with no TimeBlock whose logging window has closed. Since the API
refuses logs after the window, that state is itself permanent.

Hour status (server `lib/time.js`, used everywhere):
- `future` — hour hasn't ended yet (`now < endsAt`) → cannot log
- `open` — ended, no block, `now < endsAt + LOG_WINDOW_HOURS` → can log
- `logged` — block exists
- `unaccounted` — no block and window closed

## 3. API routes (all under `/api`, all except login require auth)

Legend: **AO** = append-only / creates only. Every `PUT`/`PATCH`/`DELETE` under `/api` not listed
below is caught by a router-level handler returning **405** with an explanation — there are no edit
or delete routes for locked data at all.

### Auth / meta
| Method & path | Notes / rules |
|---|---|
| `POST /auth/login` | bcrypt compare with `PASSWORD_HASH`; rate-limited 5 / 15 min per IP; sets httpOnly, SameSite=Strict JWT cookie (7 days). Token embeds a fingerprint of the hash, so running `set-password` invalidates old sessions. |
| `POST /auth/logout` | clears cookie |
| `GET /auth/me` | session check |
| `GET /meta/now` | server's IST now, today, current hour, `LOG_WINDOW_HOURS`, tz — the client's only clock |

### Categories
| `GET /categories?includeArchived=1` | |
| `POST /categories` | **AO**. name unique (case-insensitive), valid hex colour |
| `POST /categories/:id/archive` · `POST /categories/:id/unarchive` | only state change allowed |
| — | `POST /blocks` and `POST /plans` reject archived categories |

### Time logging
| `GET /days/:date` | 24 hours with status, block, effective plan, adherence per hour + day summary. Any date (read-only view for calendar). |
| `GET /days/open` | all currently loggable hours (today + yesterday's still-open hours) |
| `POST /blocks` | **AO**. Rules: hour must be `open` (not future, not past window, not already logged → 409); category exists & not archived; energy 1–5; alignment enum; stopDoingItem exists. Server sets `loggedAt`, `lateMinutes`, `startsAt`. |
| `POST /blocks/:id/notes` | **AO**. `$push` a note `{text, createdAt: now}` — only change ever permitted |
| `GET /blocks/:id` | |

### Plan vs actual
| `GET /plans/:date` | effective plan + revision history per hour |
| `POST /plans` | **AO** (new revision). `date` ∈ {today, tomorrow}; hour must not have started; category not archived. Body `{date, hour, activity, category}` or `{date, hour, cleared:true}`. Bulk variant `POST /plans/bulk` for filling several hours at once. |

### Dashboard & goals
| `GET /dashboard` | latest goal + contribution, today's hours logged, unaccounted, alignment %, adherence %, current streak |
| `GET /goals` | full history of both kinds (timeline) |
| `POST /goals` | **AO**. `{kind, text}` |

### Calendar
| `GET /calendar?month=YYYY-MM` | per day: logged hours, unaccounted hours, dominant category + colour, alignment % (aggregation pipeline + derived unaccounted) |

### Stop Doing
| `GET /stop-doing` | items with relapse counts |
| `GET /stop-doing/:id` | item + relapse timeline (linked blocks) |
| `POST /stop-doing` | **AO** |
| `POST /stop-doing/:id/resolve` | one-way state change |

### Reflections
| `GET /reflections/:date` · `GET /reflections?from&to` | |
| `POST /reflections` | **AO**. One per date (unique → 409). Date allowed: see Q5. |
| `POST /reflections/:date/notes` | **AO** note append |

### Weekly review
| `GET /reviews/week?start=YYYY-MM-DD` | hours by category, alignment %, adherence %, unaccounted, avg energy, relapses, the week's reflections |

### Letters
| `GET /letters` | list: `{id, title, unlockDate, createdAt, unlocked}` — **never `body` while sealed** (projection excludes it in the query itself) |
| `GET /letters/:id` | body only if `now ≥ unlocksAt`, otherwise title/date + `sealed: true` |
| `POST /letters` | **AO**. unlockDate must be after today (IST) |

### Analytics (server-side aggregation pipelines)
| `GET /analytics/categories?period=day\|week\|month&from&to` | hours per category per bucket |
| `GET /analytics/heatmap?year=YYYY` | per-day hours logged + alignment % |
| `GET /analytics/energy-by-hour?from&to` | avg energy per hour-of-day |
| `GET /analytics/sleep?from&to` | per night: sleep hours, bedtime, wake time (from Sleep-category blocks) |
| `GET /analytics/week-compare?a=YYYY-MM-DD&b=YYYY-MM-DD` | category hours, week A vs B |
| `GET /analytics/streaks` | current + longest run of fully logged days |

### Export
| `GET /export/json` | all collections (letters' bodies only if unlocked — see Q9) |
| `GET /export/blocks.csv` | time logs as CSV |

## 4. Tests (Jest + Supertest + mongodb-memory-server, fake clock injected into `lib/time.js`)
Locked blocks (edit/delete → 405, duplicate → 409, model-level update/delete throws), notes-only
appends, late-logging window (edge at exactly 12h), no future/current-hour logging, timezone (an hour
at 23:00 IST is "yesterday" even though UTC says otherwise), plan locking at hour start, no deletes on
any collection, sealed letters never leak body (list, detail, export), archived categories rejected
for new logs/plans but old logs keep them, reflection one-per-day + locked, stop-doing no delete,
auth required + rate limit.

## 5. Phases
1. Setup, CLAUDE.md, auth, categories, 24h grid (locking, notes, window, tz) + tests
2. Dashboard/goals, plan vs actual, calendar, Stop Doing + tests
3. Reflections, weekly review, letters + tests
4. Analytics, export, backup script, PWA
