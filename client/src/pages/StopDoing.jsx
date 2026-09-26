import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatInstant } from '../format';

export default function StopDoing() {
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/stop-doing').then(setItems).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/stop-doing', { title, description });
      setTitle('');
      setDescription('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const active = (items || []).filter((i) => i.status === 'active');
  const resolved = (items || []).filter((i) => i.status === 'resolved');

  const renderItem = (i) => (
    <li key={i._id}>
      <Link to={`/stop-doing/${i._id}`} className="list-row link-row">
        <span className="stack tight">
          <span>{i.title}</span>
          <span className="muted small">
            {i.lastRelapse ? `last relapse ${formatInstant(i.lastRelapse)}` : 'no relapses logged'}
          </span>
        </span>
        <span className={`relapse-count ${i.relapses ? 'bad' : ''}`}>{i.relapses}</span>
      </Link>
    </li>
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>Stop Doing</h1>
      </div>
      <form className="card glass stack" onSubmit={add}>
        <h2>Add a habit to eliminate</h2>
        <input placeholder="e.g. Scrolling in bed" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Why it has to go (optional)"
          rows={2}
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="muted small">Items can be resolved but never deleted. Link a logged hour to an item to record a relapse.</p>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="btn primary" disabled={!title.trim()}>
            Add
          </button>
        </div>
      </form>
      <section className="card glass">
        <h2>Active</h2>
        {items && active.length === 0 && <p className="muted small">Nothing here yet.</p>}
        <ul className="list">{active.map(renderItem)}</ul>
      </section>
      {resolved.length > 0 && (
        <section className="card glass">
          <h2>Resolved</h2>
          <ul className="list">{resolved.map(renderItem)}</ul>
        </section>
      )}
    </div>
  );
}
