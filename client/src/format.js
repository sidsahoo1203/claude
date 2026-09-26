const pad = (n) => String(n).padStart(2, '0');

export const hourLabel = (h) => `${pad(h)}:00`;
export const hourRange = (h) => `${pad(h)}:00–${pad((h + 1) % 24)}:00`;

// Formats an ISO instant in the app's time zone (IST), independent of the device's zone.
export function formatInstant(iso, tz = 'Asia/Kolkata', opts = {}) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  }).format(new Date(iso));
}

// "2026-09-26" -> "Sat, 26 Sep 2026" (date-only strings are calendar dates, formatted in UTC to avoid shifts)
export function formatDate(date, opts = {}) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(new Date(`${date}T00:00:00Z`));
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const ALIGNMENT = {
  toward: { label: 'Toward goal', short: '↑', cls: 'align-toward' },
  neutral: { label: 'Neutral', short: '·', cls: 'align-neutral' },
  against: { label: 'Against goal', short: '↓', cls: 'align-against' },
};

export function lateText(minutes) {
  if (!minutes) return 'on time';
  if (minutes < 60) return `${minutes} min late`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ''} late`;
}
