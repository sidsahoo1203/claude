import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | in | out

  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setStatus(r.authenticated ? 'in' : 'out'))
      .catch(() => setStatus('out'));
    const onExpired = () => setStatus('out');
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (password) => {
    await api.post('/auth/login', { password });
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setStatus('out');
  }, []);

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
