import { Link } from 'react-router-dom';
import { NAV } from '../nav';
import { useAuth } from '../context/AuthContext';

export default function More() {
  const { logout } = useAuth();
  return (
    <div className="page">
      <div className="page-head">
        <h1>More</h1>
      </div>
      <section className="card glass">
        <ul className="list">
          {NAV.filter((n) => !n.primary).map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="list-row link-row">
                <span>
                  <span className="more-icon">{n.icon}</span> {n.label}
                </span>
                <span className="muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <button className="btn ghost" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
