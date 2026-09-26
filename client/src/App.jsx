import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ClockProvider } from './context/ClockContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Today from './pages/Today';
import Plan from './pages/Plan';
import Calendar from './pages/Calendar';
import Day from './pages/Day';
import StopDoing from './pages/StopDoing';
import StopDoingDetail from './pages/StopDoingDetail';
import Categories from './pages/Categories';
import More from './pages/More';
import Reflection from './pages/Reflection';
import WeeklyReview from './pages/WeeklyReview';
import Letters from './pages/Letters';
import Letter from './pages/Letter';
import Export from './pages/Export';

// Chart.js only loads when Analytics is opened.
const Analytics = lazy(() => import('./pages/Analytics'));

export default function App() {
  const { status, retry } = useAuth();
  if (status === 'loading') return <div className="splash">⧗</div>;
  if (status === 'offline') {
    return (
      <div className="login-wrap">
        <div className="login glass stack">
          <div className="brand big">
            <span className="brand-mark">⧗</span>
            <span>Hourglass</span>
          </div>
          <p>You're offline.</p>
          <p className="muted small">
            Logging needs the server clock, so it only works online. Your hours stay open for the logging window, so
            nothing is lost yet.
          </p>
          <button className="btn primary" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (status === 'out') return <Login />;
  return (
    <ClockProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="today" element={<Today />} />
          <Route path="plan" element={<Plan />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="day/:date" element={<Day />} />
          <Route path="stop-doing" element={<StopDoing />} />
          <Route path="stop-doing/:id" element={<StopDoingDetail />} />
          <Route path="categories" element={<Categories />} />
          <Route path="reflection" element={<Reflection />} />
          <Route path="reflection/:date" element={<Reflection />} />
          <Route path="week" element={<WeeklyReview />} />
          <Route path="letters" element={<Letters />} />
          <Route path="letters/:id" element={<Letter />} />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<p className="muted">Loading…</p>}>
                <Analytics />
              </Suspense>
            }
          />
          <Route path="export" element={<Export />} />
          <Route path="more" element={<More />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ClockProvider>
  );
}
