import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useClock } from '../context/ClockContext';
import { addDays, formatDate, formatInstant } from '../format';

function daysUntil(today, date) {
  return Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
}

export default function Letters() {
  const clock = useClock();
  const [letters, setLetters] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', unlockDate: '' });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/letters').then(setLetters).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (!clock) return <p className="muted">Loading…</p>;
  const minDate = addDays(clock.today, 1);
  const valid = form.title.trim() && form.body.trim() && form.unlockDate >= minDate;

  async function send() {
    setBusy(true);
    setError('');
    try {
      await api.post('/letters', form);
      setForm({ title: '', body: '', unlockDate: '' });
      setConfirming(false);
      load();
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const sealed = (letters || []).filter((l) => !l.unlocked);
  const opened = (letters || []).filter((l) => l.unlocked).reverse();

  return (
    <div className="page">
      <div className="page-head">
        <h1>Letters to future self</h1>
      </div>

      <form
        className="card glass stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setConfirming(true);
        }}
      >
        <h2>Write a letter</h2>
        <input
          placeholder="Title"
          value={form.title}
          maxLength={200}
          disabled={confirming}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          rows={7}
          placeholder="Dear future me…"
          value={form.body}
          maxLength={20000}
          disabled={confirming}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <label className="field">
          <span>Opens on</span>
          <input
            type="date"
            min={minDate}
            value={form.unlockDate}
            disabled={confirming}
            onChange={(e) => setForm((f) => ({ ...f, unlockDate: e.target.value }))}
          />
        </label>
        <div className="row wrap quick-dates">
          {[
            ['1 month', 30],
            ['6 months', 182],
            ['1 year', 365],
            ['5 years', 1826],
          ].map(([label, n]) => (
            <button
              type="button"
              key={label}
              className="btn ghost small"
              disabled={confirming}
              onClick={() => setForm((f) => ({ ...f, unlockDate: addDays(clock.today, n) }))}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        {confirming ? (
          <>
            <p className="warn-box">
              This letter will be sealed until <strong>{formatDate(form.unlockDate)}</strong>. Until then even you can only
              see its title. It can never be edited or deleted.
            </p>
            <div className="row end">
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Keep writing
              </button>
              <button type="button" className="btn primary" onClick={send} disabled={busy}>
                {busy ? 'Sealing…' : 'Seal letter'}
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

      {sealed.length > 0 && (
        <section className="card glass">
          <h2>Sealed</h2>
          <ul className="list">
            {sealed.map((l) => {
              const n = daysUntil(clock.today, l.unlockDate);
              return (
                <li key={l._id} className="list-row">
                  <span className="stack tight">
                    <span>🔒 {l.title}</span>
                    <span className="muted small">
                      written {formatInstant(l.createdAt, undefined, { hour: undefined, minute: undefined, year: 'numeric' })} · opens {formatDate(l.unlockDate)}
                    </span>
                  </span>
                  <span className="countdown">{n === 1 ? 'tomorrow' : `${n}d`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {opened.length > 0 && (
        <section className="card glass">
          <h2>Opened</h2>
          <ul className="list">
            {opened.map((l) => (
              <li key={l._id}>
                <Link to={`/letters/${l._id}`} className="list-row link-row">
                  <span className="stack tight">
                    <span>✉️ {l.title}</span>
                    <span className="muted small">opened {formatDate(l.unlockDate)}</span>
                  </span>
                  <span className="muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {letters && letters.length === 0 && <p className="muted small">No letters yet.</p>}
    </div>
  );
}
