import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDate, formatInstant } from '../format';
import NotesThread from '../components/NotesThread';

export const QUESTIONS = [
  { key: 'wentWell', label: 'What went well?' },
  { key: 'didntGoWell', label: "What didn't?" },
  { key: 'changeTomorrow', label: 'One change for tomorrow?' },
];

export function ReflectionView({ reflection, onChanged }) {
  const [r, setR] = useState(reflection);
  useEffect(() => setR(reflection), [reflection]);
  async function addNote(text) {
    setR(await api.post(`/reflections/${r.date}/notes`, { text }));
    onChanged?.();
  }
  return (
    <div className="stack">
      <p className="muted small">🔒 written {formatInstant(r.createdAt, undefined, { year: 'numeric' })}</p>
      {QUESTIONS.map((q) => (
        <div key={q.key} className="qa">
          <h3>{q.label}</h3>
          <p>{r[q.key]}</p>
        </div>
      ))}
      <NotesThread notes={r.notes || []} onAdd={addNote} />
    </div>
  );
}

function ReflectionForm({ date, onSaved }) {
  const [form, setForm] = useState({ wentWell: '', didntGoWell: '', changeTomorrow: '' });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = QUESTIONS.every((q) => form[q.key].trim());

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/reflections', { date, ...form });
      onSaved();
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setConfirming(true);
      }}
    >
      {QUESTIONS.map((q) => (
        <label key={q.key} className="field">
          <span className="q-label">{q.label}</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={form[q.key]}
            disabled={confirming}
            onChange={(e) => setForm((f) => ({ ...f, [q.key]: e.target.value }))}
          />
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      {confirming ? (
        <>
          <p className="warn-box">Once saved, this reflection is locked forever. You can only add notes later.</p>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep editing
            </button>
            <button type="button" className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Lock it in'}
            </button>
          </div>
        </>
      ) : (
        <div className="row end">
          <button className="btn primary" disabled={!valid}>
            Review
          </button>
        </div>
      )}
    </form>
  );
}

export default function Reflection() {
  const { date: routeDate } = useParams();
  const [open, setOpen] = useState(null);
  const [selected, setSelected] = useState(null);
  const [current, setCurrent] = useState(undefined); // undefined = loading, null = none
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    try {
      const [o, list] = await Promise.all([api.get('/reflections/open'), api.get('/reflections')]);
      setOpen(o);
      setRecent(list);
      setSelected((s) => s || routeDate || o[o.length - 1].date);
    } catch (e) {
      setError(e.message);
    }
  }, [routeDate]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (routeDate) setSelected(routeDate);
  }, [routeDate]);

  useEffect(() => {
    if (!selected) return;
    setCurrent(undefined);
    api
      .get(`/reflections/${selected}`)
      .then(setCurrent)
      .catch((e) => (e.status === 404 ? setCurrent(null) : setError(e.message)));
  }, [selected]);

  if (error) return <p className="error">{error}</p>;
  if (!open || !selected) return <p className="muted">Loading…</p>;
  const writable = open.some((o) => o.date === selected);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Reflection</h1>
        {open.length > 1 && (
          <div className="segmented tabs">
            {open.map((o) => (
              <button key={o.date} className={selected === o.date ? 'on' : ''} onClick={() => setSelected(o.date)}>
                {o.date === open[open.length - 1].date ? 'Today' : 'Yesterday'}
                {o.written ? ' ✓' : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      <section className="card glass stack">
        <h2>{formatDate(selected)}</h2>
        {current === undefined && <p className="muted">Loading…</p>}
        {current && <ReflectionView reflection={current} onChanged={loadList} />}
        {current === null &&
          (writable ? (
            <ReflectionForm
              date={selected}
              onSaved={async () => {
                setCurrent(await api.get(`/reflections/${selected}`));
                loadList();
              }}
            />
          ) : (
            <p className="muted">No reflection was written for this day, and it can no longer be written.</p>
          ))}
      </section>
      {recent.length > 0 && (
        <section className="card glass">
          <h2>Recent reflections</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r._id}>
                <Link to={`/reflection/${r.date}`} className="list-row link-row" onClick={() => setSelected(r.date)}>
                  <span className="stack tight">
                    <span>{formatDate(r.date)}</span>
                    <span className="muted small clamp">→ {r.changeTomorrow}</span>
                  </span>
                  <span className="muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
