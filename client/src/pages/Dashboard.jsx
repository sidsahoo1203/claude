import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatDate, formatInstant } from '../format';
import StatCard from '../components/StatCard';
import Timeline from '../components/Timeline';

const KINDS = {
  goal: { title: 'Long-term goal', empty: 'What are you working towards?', add: 'New version of goal' },
  contribution: { title: 'Why it matters', empty: 'What will this goal contribute, and to whom?', add: 'New version of statement' },
};

function Statement({ kind, current, history, onAdded }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const meta = KINDS[kind];

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/goals', { kind, text });
      setText('');
      setEditing(false);
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  }

  const earlier = history.slice(1);
  return (
    <section className={`card glass statement statement-${kind}`}>
      <div className="row">
        <h2 className="grow-title">{meta.title}</h2>
        {!editing && (
          <button className="btn ghost small" onClick={() => setEditing(true)}>
            {current ? 'Add new version' : 'Write it'}
          </button>
        )}
      </div>
      {current ? (
        <>
          <p className="statement-text">{current.text}</p>
          <p className="muted small">since {formatInstant(current.createdAt, undefined, { year: 'numeric' })}</p>
        </>
      ) : (
        !editing && <p className="muted">{meta.empty}</p>
      )}
      {editing && (
        <form className="stack tight" onSubmit={save}>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={meta.empty}
            autoFocus
          />
          <p className="muted small">Earlier versions are kept forever in the history.</p>
          {error && <p className="error">{error}</p>}
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={!text.trim()}>
              Save version
            </button>
          </div>
        </form>
      )}
      {earlier.length > 0 && (
        <div className="history">
          <button className="linklike small" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? 'Hide' : 'Show'} {earlier.length} earlier version{earlier.length > 1 ? 's' : ''}
          </button>
          {showHistory && <Timeline items={earlier} />}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [dash, setDash] = useState(null);
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([api.get('/dashboard'), api.get('/goals')]);
      setDash(d);
      setGoals(g);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!dash) return <p className="muted">Loading…</p>;
  const t = dash.today;
  const pct = (v) => (v == null ? '—' : `${v}%`);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Home</h1>
        <span className="muted">{formatDate(t.date)}</span>
      </div>

      {!t.reflected && (
        <Link to="/reflection" className="card glass prompt-card">
          <span>✎</span>
          <span className="stack tight">
            <strong>Today's reflection</strong>
            <span className="muted small">What went well, what didn't, one change for tomorrow.</span>
          </span>
          <span className="muted">›</span>
        </Link>
      )}

      <Statement kind="goal" current={goals.goal} history={goals.history.goal} onAdded={load} />
      <Statement kind="contribution" current={goals.contribution} history={goals.history.contribution} onAdded={load} />

      <section className="stack tight">
        <div className="row">
          <h2 className="grow-title">Today so far</h2>
          <Link to="/today" className="btn small">
            Open grid →
          </Link>
        </div>
        <div className="stats stats-5">
          <StatCard label="Hours logged" value={t.logged} hint={t.open ? `${t.open} waiting to log` : undefined} />
          <StatCard label="Unaccounted" value={t.unaccounted} tone={t.unaccounted ? 'bad' : 'good'} />
          <StatCard label="Alignment" value={pct(t.alignmentPct)} hint="toward goal / logged" />
          <StatCard label="Plan adherence" value={pct(t.adherencePct)} hint={t.planned ? `${t.planHits}/${t.planDecided} planned hours` : 'no plan'} />
          <StatCard
            label="Logging streak"
            value={`${dash.streak.current}d`}
            hint={`longest ${dash.streak.longest}d`}
            tone={dash.streak.current ? 'good' : undefined}
          />
        </div>
      </section>
    </div>
  );
}
