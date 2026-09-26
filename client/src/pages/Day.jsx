import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { addDays, formatDate } from '../format';
import HourGrid from '../components/HourGrid';
import HourDialog from '../components/HourDialog';
import StatCard from '../components/StatCard';

// View of any day. Locked blocks can receive notes; hours still inside the window can be logged.
export default function Day() {
  const { date } = useParams();
  const [day, setDay] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get(`/days/${date}`)
      .then((d) => {
        setDay(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [date]);

  useEffect(() => {
    setDay(null);
    load();
  }, [load]);

  const select = (h) => (h.block || h.status === 'open' ? setSelected(h) : null);

  return (
    <div className="page">
      <div className="page-head">
        <Link className="btn ghost small" to={`/day/${addDays(date, -1)}`}>
          ‹
        </Link>
        <h1>{formatDate(date)}</h1>
        <Link className="btn ghost small" to={`/day/${addDays(date, 1)}`}>
          ›
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {day && (
        <>
          <div className="stats">
            <StatCard label="Hours logged" value={day.summary.logged} />
            <StatCard label="Unaccounted" value={day.summary.unaccounted} tone={day.summary.unaccounted ? 'bad' : undefined} />
            <StatCard label="Alignment" value={day.summary.alignmentPct == null ? '—' : `${day.summary.alignmentPct}%`} />
            <StatCard label="Avg energy" value={day.summary.avgEnergy ?? '—'} />
          </div>
          <section className="card glass">
            <HourGrid hours={day.hours.map((h) => ({ ...h, date }))} onSelect={select} />
          </section>
        </>
      )}
      {selected && <HourDialog hour={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
