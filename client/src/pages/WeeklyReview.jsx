import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { addDays, formatDate, hourRange } from '../format';
import StatCard from '../components/StatCard';
import { QUESTIONS } from './Reflection';

const pct = (v) => (v == null ? '—' : `${v}%`);
const short = (date) => formatDate(date, { year: undefined, weekday: 'short', month: 'short' });

export default function WeeklyReview() {
  const [params, setParams] = useSearchParams();
  const start = params.get('start');
  const [w, setW] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setW(null);
    api
      .get(`/reviews/week${start ? `?start=${start}` : ''}`)
      .then(setW)
      .catch((e) => setError(e.message));
  }, [start]);

  if (error) return <p className="error">{error}</p>;
  if (!w) return <p className="muted">Loading…</p>;
  const t = w.totals;
  const maxHours = Math.max(1, ...w.categories.map((c) => c.hours));
  const go = (n) => setParams({ start: addDays(w.start, n) });

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost small" onClick={() => go(-7)} aria-label="Previous week">
          ‹
        </button>
        <h1 className="center-title">
          Week of {short(w.start)}
          <span className="muted small block">to {short(w.end)}</span>
        </h1>
        <button className="btn ghost small" onClick={() => go(7)} aria-label="Next week">
          ›
        </button>
      </div>

      <div className="stats stats-6">
        <StatCard label="Hours logged" value={t.logged} />
        <StatCard label="Unaccounted" value={t.unaccounted} tone={t.unaccounted ? 'bad' : 'good'} />
        <StatCard label="Alignment" value={pct(t.alignmentPct)} />
        <StatCard label="Plan adherence" value={pct(t.adherencePct)} hint={t.planDecided ? `${t.planHits}/${t.planDecided} hours` : 'no plans'} />
        <StatCard label="Avg energy" value={t.avgEnergy ?? '—'} hint="out of 5" />
        <StatCard label="Relapses" value={t.relapses} tone={t.relapses ? 'bad' : 'good'} />
      </div>

      <section className="card glass">
        <h2>Hours by category</h2>
        {w.categories.length === 0 ? (
          <p className="muted small">Nothing logged this week.</p>
        ) : (
          <ul className="bars">
            {w.categories.map((c) => (
              <li key={c._id} style={{ '--cat': c.color }}>
                <span className="bar-label">
                  <span className="cat-chip" style={{ '--cat': c.color }}>
                    <span className="dot" />
                    {c.name}
                  </span>
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(c.hours / maxHours) * 100}%` }} />
                </span>
                <span className="bar-value">{c.hours}h</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card glass">
        <h2>Day by day</h2>
        <div className="table-wrap">
          <table className="week-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Logged</th>
                <th>Gap</th>
                <th>Align</th>
                <th>Plan</th>
                <th>Energy</th>
                <th>✎</th>
              </tr>
            </thead>
            <tbody>
              {w.days.map((d) => {
                const inactive = d.state === 'future' || d.state === 'untracked';
                return (
                  <tr key={d.date} className={inactive ? 'dim' : ''}>
                    <td>
                      {inactive ? (
                        short(d.date)
                      ) : (
                        <Link to={`/day/${d.date}`}>
                          <span className="dot-inline" style={{ background: d.dominant?.color || 'transparent' }} />
                          {short(d.date)}
                        </Link>
                      )}
                    </td>
                    {inactive ? (
                      <td colSpan={6} className="muted small">
                        {d.state === 'future' ? 'not yet' : 'not tracked'}
                      </td>
                    ) : (
                      <>
                        <td>{d.logged}h</td>
                        <td className={d.unaccounted ? 'align-against' : ''}>{d.unaccounted}h</td>
                        <td>{pct(d.alignmentPct)}</td>
                        <td>{pct(d.adherencePct)}</td>
                        <td>{d.avgEnergy ?? '—'}</td>
                        <td>{d.reflected ? '✓' : '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {w.relapses.length > 0 && (
        <section className="card glass">
          <h2>Relapses</h2>
          <ul className="list">
            {w.relapses.map((r) => (
              <li key={r.item?._id} className="list-row">
                <span className="stack tight">
                  <Link to={`/stop-doing/${r.item?._id}`}>{r.item?.title}</Link>
                  <span className="muted small">
                    {r.blocks.map((b) => `${short(b.date)} ${hourRange(b.hour)}`).join(' · ')}
                  </span>
                </span>
                <span className="relapse-count bad">{r.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card glass">
        <h2>Reflections</h2>
        {w.reflections.length === 0 && <p className="muted small">No reflections this week.</p>}
        <div className="stack">
          {w.reflections.map((r) => (
            <details key={r._id} className="reflection-item">
              <summary>
                <strong>{short(r.date)}</strong> <span className="muted small">→ {r.changeTomorrow}</span>
              </summary>
              {QUESTIONS.map((q) => (
                <div key={q.key} className="qa">
                  <h3>{q.label}</h3>
                  <p>{r[q.key]}</p>
                </div>
              ))}
              {r.notes?.length > 0 && <p className="muted small">✎ {r.notes.length} note(s) · <Link to={`/reflection/${r.date}`}>open</Link></p>}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
