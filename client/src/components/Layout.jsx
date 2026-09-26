import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClock } from '../context/ClockContext';
import { formatDate } from '../format';

const NAV = [
  { to: '/', label: 'Today', icon: '◷', end: true },
  { to: '/categories', label: 'Categories', icon: '◍' },
];

export default function Layout() {
  const { logout } = useAuth();
  const clock = useClock();
  return (
    <div className="shell">
      <header className="topbar glass">
        <div className="brand">
          <span className="brand-mark">⧗</span>
          <span>Hourglass</span>
        </div>
        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          {clock && <span className="muted small hide-sm">{formatDate(clock.today)}</span>}
          <button className="btn ghost small" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottomnav glass">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <span className="icon">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
