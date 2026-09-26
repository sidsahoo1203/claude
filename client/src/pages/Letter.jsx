import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDate, formatInstant } from '../format';

export default function Letter() {
  const { id } = useParams();
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/letters/${id}`).then(setLetter).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!letter) return <p className="muted">Loading…</p>;

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/letters" className="btn ghost small">
          ‹
        </Link>
        <h1>{letter.title}</h1>
      </div>
      <article className="card glass letter">
        <p className="muted small">
          Written {formatInstant(letter.createdAt, undefined, { year: 'numeric' })} · opened {formatDate(letter.unlockDate)}
        </p>
        {letter.unlocked ? (
          <div className="letter-body">{letter.body}</div>
        ) : (
          <p className="muted">🔒 Sealed until {formatDate(letter.unlockDate)}.</p>
        )}
      </article>
    </div>
  );
}
