import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useClock } from '../context/ClockContext';
import { addDays, formatDate, hourRange } from '../format';
import Modal from '../components/Modal';
import Timeline from '../components/Timeline';

export default function Plan() {
  const clock = useClock();
  const [which, setWhich] = useState('today');
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState({ activity: '', category: '' });
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const date = clock ? (which === 'today' ? clock.today : addDays(clock.today, 1)) : null;

  const load = useCallback(async () => {
    if (!date) return;
    try {
      setData(await api.get(`/plans/${date}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [date]);

  useEffect(() => {
    setSelected(new Set());
    load();
  }, [load]);
  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
  }, []);

  const toggle = (h) => {
    if (h.locked) return setHistory(h);
    setSelected((s) => {
      const n = new Set(s);
      n.has(h.hour) ? n.delete(h.hour) : n.add(h.hour);
      return n;
    });
  };

  async function submit(cleared) {
    setBusy(true);
    setError('');
    try {
      const hours = [...selected].sort((a, b) => a - b);
      await api.post('/plans/bulk', cleared ? { date, hours, cleared: true } : { date, hours, ...form });
      setSelected(new Set());
      setForm((f) => ({ ...f, activity: '' }));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const unlocked = data ? data.hours.filter((h) => !h.locked) : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>Plan</h1>
        <div className="segmented tabs">
          <button className={which === 'today' ? 'on' : ''} onClick={() => setWhich('today')}>
            Today
          </button>
          <button className={which === 'tomorrow' ? 'on' : ''} onClick={() => setWhich('tomorrow')}>
            Tomorrow
          </button>
        </div>
      </div>
      {date && <p className="muted small">{formatDate(date)} · tap hours to select them, then assign. Hours lock when they start.</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <section className="card glass">
          <div className="row">
            <span className="muted small grow-title">{selected.size} selected</span>
            {unlocked.length > 0 && (
              <button className="btn ghost small" onClick={() => setSelected(new Set(unlocked.map((h) => h.hour)))}>
                Select all open
              </button>
            )}
            {selected.size > 0 && (
              <button className="btn ghost small" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            )}
          </div>
          <ol className="hour-grid">
            {data.hours.map((h) => (
              <li key={h.hour}>
                <button
                  className={`hour-row plan-row ${h.locked ? 'locked' : ''} ${selected.has(h.hour) ? 'selected' : ''}`}
                  style={h.plan ? { '--cat': h.plan.category?.color } : undefined}
                  onClick={() => toggle(h)}
                >
                  <span className="hour-time">{hourRange(h.hour)}</span>
                  <span className="hour-main">
                    {h.plan ? (
                      <>
                        <span className="hour-activity">{h.plan.activity || h.plan.category?.name}</span>
                        <span className="hour-meta">
                          <span className="cat-chip" style={{ '--cat': h.plan.category?.color }}>
                            <span className="dot" />
                            {h.plan.category?.name}
                          </span>
                          {h.revisions.length > 1 && <span className="muted small">revised {h.revisions.length - 1}×</span>}
                        </span>
                      </>
                    ) : (
                      <span className="hour-empty">{h.locked ? 'Unplanned' : 'No plan'}</span>
                    )}
                  </span>
                  <span className="hour-lock">{h.locked ? '🔒' : selected.has(h.hour) ? '☑' : '☐'}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {selected.size > 0 && (
        <div className="action-sheet glass">
          <div className="stack tight">
            <input
              placeholder="Planned activity (optional)"
              value={form.activity}
              maxLength={500}
              onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
            />
            <div className="chip-picker">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c._id}
                  className={`cat-chip pick ${form.category === c._id ? 'selected' : ''}`}
                  style={{ '--cat': c.color }}
                  onClick={() => setForm((f) => ({ ...f, category: c._id }))}
                >
                  <span className="dot" />
                  {c.name}
                </button>
              ))}
            </div>
            <div className="row end">
              <button className="btn ghost" disabled={busy} onClick={() => submit(true)}>
                Remove plan
              </button>
              <button className="btn primary" disabled={busy || !form.category} onClick={() => submit(false)}>
                Plan {selected.size} hour{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <Modal title={`${hourRange(history.hour)} · plan history`} onClose={() => setHistory(null)}>
          <p className="muted small">This hour has started, so its plan is locked.</p>
          <Timeline
            items={history.revisions}
            render={(r) => <p>{r.cleared ? <em className="muted">Plan removed</em> : `${r.activity || '—'} · ${r.category?.name}`}</p>}
          />
        </Modal>
      )}
    </div>
  );
}
