import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

// The server decides what "now" and "today" are (APP_TZ). The device clock is never trusted.
const ClockContext = createContext(null);

export function ClockProvider({ children }) {
  const [clock, setClock] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get('/meta/now')
        .then((c) => alive && setClock(c))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export const useClock = () => useContext(ClockContext);
