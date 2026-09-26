import { useEffect, useState } from 'react';
import { api } from '../api';
import { ALIGNMENT, formatDate, formatInstant, hourRange } from '../format';

export default function LogForm({ hour, onSaved, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [stopItems, setStopItems] = useState([]);
  const [form, setForm] = useState({ activity: '', category: '', energy: 3, alignment: 'neutral', stopDoingItem: '' });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/categories').then(setCategories).catch((e) => setError(e.message));
    api.get('/stop-doing').then(setStopItems).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));
  const valid = form.activity.trim() && form.category;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.post('/blocks', {
        date: hour.date,
        hour: hour.hour,
        ...form,
        energy: Number(form.energy),
        stopDoingItem: form.stopDoingItem || null,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  const cat = categories.find((c) => c._id === form.category);
  const relapse = stopItems.find((i) => i._id === form.stopDoingItem);

  if (confirming) {
    return (
      <div className="stack">
        <p className="warn-box">
          This hour will be <strong>locked forever</strong>. You will only be able to add notes to it afterwards.
        </p>
        <dl className="kv">
          <dt>Hour</dt>
          <dd>
            {formatDate(hour.date)} · {hourRange(hour.hour)}
          </dd>
          <dt>Activity</dt>
          <dd>{form.activity}</dd>
          <dt>Category</dt>
          <dd>
            <span className="cat-chip" style={{ '--cat': cat?.color }}>
              <span className="dot" />
              {cat?.name}
            </span>
          </dd>
          <dt>Energy</dt>
          <dd>{form.energy} / 5</dd>
          <dt>Alignment</dt>
          <dd>{ALIGNMENT[form.alignment].label}</dd>
          {relapse && (
            <>
              <dt>Relapse</dt>
              <dd className="align-against">{relapse.title}</dd>
            </>
          )}
        </dl>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="btn ghost" onClick={() => setConfirming(false)} disabled={saving}>
            Back
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Lock it in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setConfirming(true);
      }}
    >
      <p className="muted small">
        {formatDate(hour.date)} · {hourRange(hour.hour)} · can be logged until {formatInstant(hour.logDeadline)}
      </p>
      <label className="field">
        <span>What did you do?</span>
        <input value={form.activity} onChange={set('activity')} maxLength={500} autoFocus required />
      </label>
      <div className="field">
        <span>Category</span>
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
      </div>
      <div className="field">
        <span>Energy / focus</span>
        <div className="segmented">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              className={Number(form.energy) === n ? 'on' : ''}
              onClick={() => setForm((f) => ({ ...f, energy: n }))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Goal alignment</span>
        <div className="segmented">
          {Object.entries(ALIGNMENT).map(([k, a]) => (
            <button
              type="button"
              key={k}
              className={`${form.alignment === k ? 'on' : ''} ${a.cls}`}
              onClick={() => setForm((f) => ({ ...f, alignment: k }))}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      {stopItems.length > 0 && (
        <label className="field">
          <span>Was this a Stop Doing relapse?</span>
          <select value={form.stopDoingItem} onChange={set('stopDoingItem')}>
            <option value="">No</option>
            {stopItems.map((i) => (
              <option key={i._id} value={i._id}>
                {i.title}
                {i.status === 'resolved' ? ' (resolved)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {hour.plan && (
        <p className="muted small">
          Planned: {hour.plan.activity || '—'} ({hour.plan.category?.name})
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!valid}>
          Review
        </button>
      </div>
    </form>
  );
}
