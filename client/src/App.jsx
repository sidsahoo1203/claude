import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ClockProvider } from './context/ClockContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Today from './pages/Today';
import Day from './pages/Day';
import Categories from './pages/Categories';

export default function App() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="splash">⧗</div>;
  if (status === 'out') return <Login />;
  return (
    <ClockProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="day/:date" element={<Day />} />
          <Route path="categories" element={<Categories />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ClockProvider>
  );
}
