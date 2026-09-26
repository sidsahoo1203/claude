import { formatInstant } from '../format';

// Generic vertical history timeline for append-only records.
export default function Timeline({ items, render }) {
  if (!items.length) return <p className="muted small">Nothing yet.</p>;
  return (
    <ol className="timeline">
      {items.map((it) => (
        <li key={it._id}>
          <time>{formatInstant(it.createdAt, undefined, { year: 'numeric' })}</time>
          {render ? render(it) : <p>{it.text}</p>}
        </li>
      ))}
    </ol>
  );
}
