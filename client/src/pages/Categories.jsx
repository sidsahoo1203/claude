import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

// Colour-blind-safe steps for the dark surface (dataviz reference palette).
const SUGGESTED = ['#3987e5', '#d95926', '#199e70', '#9085e9', '#c98500', '#d55181', '#008300', '#e66767'];

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUGGESTED[0]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/categories?includeArchived=1').then(setCats).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/categories', { name, color });
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(c) {
    setError('');
    try {
      await api.post(`/categories/${c._id}/${c.archived ? 'unarchive' : 'archive'}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const active = cats.filter((c) => !c.archived);
  const archived = cats.filter((c) => c.archived);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Categories</h1>
      </div>

      <form className="card glass stack" onSubmit={create}>
        <h2>New category</h2>
        <p className="muted small">Names and colours are permanent. Categories can be archived but never deleted.</p>
        <div className="row wrap">
          <label className="field grow">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            <span>Colour</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color-input" />
          </label>
        </div>
        <div className="swatches">
          {SUGGESTED.map((c) => (
            <button
              type="button"
              key={c}
              className={`swatch ${c === color ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="btn primary" disabled={!name.trim()}>
            Add category
          </button>
        </div>
      </form>

      <section className="card glass">
        <h2>Active</h2>
        <ul className="list">
          {active.map((c) => (
            <li key={c._id} className="list-row">
              <span className="cat-chip" style={{ '--cat': c.color }}>
                <span className="dot" />
                {c.name}
              </span>
              <button className="btn ghost small" onClick={() => toggle(c)}>
                Archive
              </button>
            </li>
          ))}
        </ul>
      </section>

      {archived.length > 0 && (
        <section className="card glass">
          <h2>Archived</h2>
          <p className="muted small">Hidden from new logs. Past logs keep them.</p>
          <ul className="list">
            {archived.map((c) => (
              <li key={c._id} className="list-row dim">
                <span className="cat-chip" style={{ '--cat': c.color }}>
                  <span className="dot" />
                  {c.name}
                </span>
                <button className="btn ghost small" onClick={() => toggle(c)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
