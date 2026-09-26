import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useClock } from '../context/ClockContext';
import { formatDate } from '../format';
import HourGrid from '../components/HourGrid';
import HourDialog from '../components/HourDialog';
import StatCard from '../components/StatCard';

export default function Today() {
  const clock = useClock();
  const [day, setDay] = useState(null);
  const [earlier, setEarlier] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!clock) return;
    try {
      const [d, open] = await Promise.all([api.get(`/days/${clock.today}`), api.get('/days/open')]);
      setDay(d);
      setEarlier(open.filter((h) => h.date !== clock.today));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [clock]);

  useEffect(() => {
    load();
  }, [load]);

  // On first load, bring the current hour into view (the morning hours are above it).
  const scrolled = useRef(false);
  useEffect(() => {
    if (!day || scrolled.current) return;
    scrolled.current = true;
    const target =
      document.querySelector('.hour-row.is-now') || [...document.querySelectorAll('.hour-row.status-open')].pop();
    target?.scrollIntoView({ block: 'center' });
  }, [day]);

  if (error) return <p className="error">{error}</p>;
  if (!day) return <p className="muted">Loading…</p>;

  const s = day.summary;
  return (
    <div className="page">
      <div className="page-head">
        <h1>Today</h1>
        <span className="muted">{formatDate(day.date)}</span>
      </div>

      <div className="stats stats-5">
        <StatCard label="Hours logged" value={s.logged} />
        <StatCard label="Unaccounted" value={s.unaccounted} tone={s.unaccounted ? 'bad' : undefined} />
        <StatCard label="Waiting to log" value={s.open} tone={s.open ? 'warn' : undefined} />
        <StatCard label="Alignment" value={s.alignmentPct == null ? '—' : `${s.alignmentPct}%`} />
        <StatCard
          label="Plan adherence"
          value={s.adherencePct == null ? '—' : `${s.adherencePct}%`}
          hint={s.planned ? `${s.planHits}/${s.planDecided} so far` : 'no plan yet'}
        />
      </div>

      {earlier.length > 0 && (
        <section className="card glass">
          <h2>Still open from yesterday</h2>
          <p className="muted small">These close {clock.logWindowHours}h after they end, then become unaccounted forever.</p>
          <HourGrid
            hours={earlier}
            onSelect={setSelected}
            showDate={(h) => formatDate(h.date, { weekday: 'short', year: undefined, month: undefined, day: undefined })}
          />
        </section>
      )}

      <section className="card glass">
        <HourGrid hours={day.hours.map((h) => ({ ...h, date: day.date }))} onSelect={setSelected} currentHour={clock?.hour} />
      </section>

      {selected && <HourDialog hour={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
