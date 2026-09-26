import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClock } from '../context/ClockContext';
import { formatDate } from '../format';
import { NAV } from '../nav';

export default function Layout() {
  const { logout } = useAuth();
  const clock = useClock();
  const { pathname } = useLocation();
  const secondaryActive = NAV.some((n) => !n.primary && pathname.startsWith(n.to)) || pathname === '/more';

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
          <button className="btn ghost small hide-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottomnav glass">
        {NAV.filter((n) => n.primary).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <span className="icon">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <NavLink to="/more" className={secondaryActive ? 'active' : ''}>
          <span className="icon">⋯</span>
          <span>More</span>
        </NavLink>
      </nav>
    </div>
  );
}
