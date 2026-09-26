import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useClock } from '../context/ClockContext';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`)
  );
}

export default function Calendar() {
  const clock = useClock();
  const [month, setMonth] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clock && !month) setMonth(clock.today.slice(0, 7));
  }, [clock, month]);

  useEffect(() => {
    if (!month) return;
    setData(null);
    api
      .get(`/calendar?month=${month}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [month]);

  if (!month) return <p className="muted">Loading…</p>;
  // Monday-first offset of the 1st of the month.
  const firstDow = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <h1 className="center-title">{monthLabel(month)}</h1>
        <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          ›
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="card glass">
        <div className="cal-grid cal-head">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: firstDow }, (_, i) => (
            <span key={`pad${i}`} />
          ))}
          {data &&
            data.days.map((d) => {
              const num = Number(d.date.slice(8));
              if (d.state === 'future' || d.state === 'untracked') {
                return (
                  <div key={d.date} className={`cal-day ${d.state}`}>
                    <span className="cal-num">{num}</span>
                  </div>
                );
              }
              return (
                <Link
                  key={d.date}
                  to={`/day/${d.date}`}
                  className={`cal-day ${d.state === 'today' ? 'today' : ''} ${d.unaccounted ? 'has-gap' : ''}`}
                  style={{ '--cat': d.dominant?.color || 'transparent' }}
                  title={`${d.logged}h logged, ${d.unaccounted}h unaccounted${d.dominant ? `, mostly ${d.dominant.name}` : ''}`}
                >
                  <span className="cal-num">{num}</span>
                  <span className="cal-hours">{d.logged}h</span>
                  <span className="cal-meta">
                    {d.alignmentPct != null && <span className="cal-align">{d.alignmentPct}%</span>}
                    {d.unaccounted > 0 && <span className="cal-gap">⦸{d.unaccounted}</span>}
                  </span>
                </Link>
              );
            })}
        </div>
      </section>
      <p className="muted small legend">
        Colour = dominant category · h = hours logged · % = alignment · <span className="cal-gap">⦸</span> = unaccounted hours
      </p>
    </div>
  );
}
