import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | in | out | offline | nobackend

  const check = useCallback(() => {
    setStatus('loading');
    api
      .get('/auth/me')
      .then((r) => setStatus(r.authenticated ? 'in' : 'out'))
      .catch((e) => setStatus(e.status === 0 ? 'offline' : e.status === -1 || e.status === 404 || e.status === 405 ? 'nobackend' : 'out'));
  }, []);

  useEffect(() => {
    check();
    const onExpired = () => setStatus('out');
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [check]);

  const login = useCallback(async (password) => {
    await api.post('/auth/login', { password });
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setStatus('out');
  }, []);

  return <AuthContext.Provider value={{ status, login, logout, retry: check }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
