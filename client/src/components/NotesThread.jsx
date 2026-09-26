import { useState } from 'react';
import { formatInstant } from '../format';

// Append-only notes on a locked record.
export default function NotesThread({ notes, onAdd }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onAdd(text.trim());
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notes">
      <h3>Notes</h3>
      {notes.length === 0 && <p className="muted small">No notes yet.</p>}
      <ol className="timeline">
        {notes.map((n) => (
          <li key={n._id}>
            <time>{formatInstant(n.createdAt, undefined, { year: 'numeric' })}</time>
            <p>{n.text}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="stack tight">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Add a note (notes can't be edited or removed later)"
        />
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="btn" disabled={saving || !text.trim()}>
            {saving ? 'Adding…' : 'Add note'}
          </button>
        </div>
      </form>
    </div>
  );
}
