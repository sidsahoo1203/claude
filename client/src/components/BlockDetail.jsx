import { useState } from 'react';
import { api } from '../api';
import { ALIGNMENT, formatDate, formatInstant, hourRange, lateText } from '../format';
import NotesThread from './NotesThread';

export default function BlockDetail({ block: initial, onChanged }) {
  const [block, setBlock] = useState(initial);

  async function addNote(text) {
    const updated = await api.post(`/blocks/${block._id}/notes`, { text });
    setBlock(updated);
    onChanged?.();
  }

  return (
    <div className="stack">
      <p className="muted small">
        {formatDate(block.date)} · {hourRange(block.hour)} · 🔒 locked
      </p>
      <p className="block-activity">{block.activity}</p>
      <dl className="kv">
        <dt>Category</dt>
        <dd>
          <span className="cat-chip" style={{ '--cat': block.category?.color }}>
            <span className="dot" />
            {block.category?.name}
            {block.category?.archived && <span className="muted small"> (archived)</span>}
          </span>
        </dd>
        <dt>Energy</dt>
        <dd>{block.energy} / 5</dd>
        <dt>Alignment</dt>
        <dd className={ALIGNMENT[block.alignment].cls}>{ALIGNMENT[block.alignment].label}</dd>
        {block.stopDoingItem && (
          <>
            <dt>Relapse</dt>
            <dd>{block.stopDoingItem.title}</dd>
          </>
        )}
        <dt>Logged</dt>
        <dd>
          {formatInstant(block.loggedAt)} ({lateText(block.lateMinutes)})
        </dd>
      </dl>
      <NotesThread notes={block.notes || []} onAdd={addNote} />
    </div>
  );
}
