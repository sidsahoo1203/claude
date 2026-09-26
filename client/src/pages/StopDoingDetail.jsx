import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDate, formatInstant, hourRange } from '../format';
import StatCard from '../components/StatCard';

export default function StopDoingDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/stop-doing/${id}`).then(setItem).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function resolve() {
    try {
      await api.post(`/stop-doing/${id}/resolve`);
      setConfirming(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!item) return <p className="muted">Loading…</p>;

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/stop-doing" className="btn ghost small">
          ‹
        </Link>
        <h1>{item.title}</h1>
      </div>
      {item.description && <p className="muted">{item.description}</p>}
      <div className="stats">
        <StatCard label="Relapses" value={item.relapses} tone={item.relapses ? 'bad' : 'good'} />
        <StatCard
          label="Status"
          value={item.status === 'resolved' ? 'Resolved' : 'Active'}
          hint={item.resolvedAt ? formatInstant(item.resolvedAt, undefined, { year: 'numeric' }) : `since ${formatInstant(item.createdAt, undefined, { year: 'numeric' })}`}
        />
      </div>
      {item.status === 'active' &&
        (confirming ? (
          <div className="card glass stack">
            <p className="warn-box">Resolving is permanent. The item and its relapse history stay visible forever.</p>
            <div className="row end">
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={resolve}>
                Mark resolved
              </button>
            </div>
          </div>
        ) : (
          <div className="row end">
            <button className="btn" onClick={() => setConfirming(true)}>
              Mark as resolved…
            </button>
          </div>
        ))}
      <section className="card glass">
        <h2>Relapse timeline</h2>
        {item.timeline.length === 0 ? (
          <p className="muted small">No logged hours are linked to this item.</p>
        ) : (
          <ol className="timeline">
            {item.timeline.map((b) => (
              <li key={b._id}>
                <time>
                  <Link to={`/day/${b.date}`}>
                    {formatDate(b.date)} · {hourRange(b.hour)}
                  </Link>
                </time>
                <p>
                  {b.activity}{' '}
                  <span className="cat-chip" style={{ '--cat': b.category?.color }}>
                    <span className="dot" />
                    {b.category?.name}
                  </span>
                  {b.afterResolved && <span className="relapse-chip"> after resolving</span>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
