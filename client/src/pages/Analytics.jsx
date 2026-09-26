import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { api } from '../api';
import { useClock } from '../context/ClockContext';
import { formatDate } from '../format';
import StatCard from '../components/StatCard';
import Heatmap from '../components/charts/Heatmap';
import DataTable from '../components/charts/DataTable';
import { axes, SURFACE, SERIES_A, SERIES_B } from '../components/charts/setup';

const pad = (n) => String(n).padStart(2, '0');
const clock = (h) => `${pad(((h % 24) + 24) % 24)}:00`;
const shortDate = (d) => formatDate(d, { weekday: undefined, year: undefined, month: 'short' });

function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setData(null);
    api
      .get(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path]);
  return [data, error];
}

function Card({ title, subtitle, children, actions }) {
  return (
    <section className="card glass chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented tabs small-tabs">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children = 'Not enough data yet.' }) {
  return <p className="muted small chart-empty">{children}</p>;
}

// ---------- Hours by category ----------
function bucketLabel(period, b) {
  if (period === 'month') {
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${b}-01T00:00:00Z`));
  }
  return period === 'week' ? `w/c ${shortDate(b)}` : shortDate(b);
}

function CategoriesCard() {
  const [period, setPeriod] = useState('week');
  const [data, error] = useApi(`/analytics/categories?period=${period}`);
  const chart = useMemo(() => {
    if (!data) return null;
    const last = data.series.length - 1;
    return {
      labels: data.buckets.map((b) => bucketLabel(period, b)),
      datasets: data.series.map((s, i) => ({
        label: s.category.name,
        data: s.values,
        backgroundColor: s.category.color,
        borderColor: SURFACE,
        borderWidth: { top: 2 },
        borderSkipped: 'bottom',
        borderRadius: i === last ? { topLeft: 4, topRight: 4 } : 0,
        maxBarThickness: 28,
      })),
    };
  }, [data, period]);
  const total = data ? data.series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0) : 0;
  return (
    <Card
      title="Hours by category"
      subtitle={data ? `${total}h logged, ${formatDate(data.from, { weekday: undefined })} – ${formatDate(data.to, { weekday: undefined })}` : ' '}
      actions={<Segmented value={period} onChange={setPeriod} options={[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]} />}
    >
      {error && <p className="error">{error}</p>}
      {chart && total === 0 && <Empty />}
      {chart && total > 0 && (
        <>
          <div className="chart-box">
            <Bar
              data={chart}
              options={{
                scales: axes({ stacked: true, yTitle: 'hours' }),
                interaction: { mode: 'index', intersect: false },
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: {
                    filter: (item) => item.raw > 0,
                    itemSort: (a, b) => b.raw - a.raw,
                    callbacks: {
                      label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
                      footer: (items) => `Total ${items.reduce((s, i) => s + i.raw, 0)}h`,
                    },
                  },
                },
              }}
            />
          </div>
          <DataTable
            columns={['Period', ...data.series.map((s) => s.category.name)]}
            rows={data.buckets.map((b, i) => [bucketLabel(period, b), ...data.series.map((s) => s.values[i])])}
          />
        </>
      )}
    </Card>
  );
}

// ---------- Year heatmap ----------
function HeatmapCard({ year }) {
  const [mode, setMode] = useState('hours');
  const [data, error] = useApi(`/analytics/heatmap?year=${year}`);
  return (
    <Card
      title={`${year} at a glance`}
      subtitle={
        data
          ? `${data.totals.logged}h logged · ${data.totals.unaccounted}h unaccounted · ${data.totals.fullDays}/${data.totals.trackedDays} days fully logged`
          : ' '
      }
      actions={<Segmented value={mode} onChange={setMode} options={[['hours', 'Hours'], ['alignment', 'Alignment %']]} />}
    >
      {error && <p className="error">{error}</p>}
      {data && <Heatmap days={data.days} mode={mode} />}
    </Card>
  );
}

// ---------- Energy by hour ----------
function EnergyCard() {
  const [data, error] = useApi('/analytics/energy-by-hour');
  const rated = data ? data.hours.filter((h) => h.count > 0) : [];
  const best = rated.length ? rated.reduce((a, b) => (b.avgEnergy > a.avgEnergy ? b : a)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (b.avgEnergy < a.avgEnergy ? b : a)) : null;
  return (
    <Card
      title="Best hours of the day"
      subtitle={best ? `Highest energy at ${clock(best.hour)} (${best.avgEnergy}/5), lowest at ${clock(worst.hour)} (${worst.avgEnergy}/5) · last 90 days` : 'Average energy/focus rating by hour · last 90 days'}
    >
      {error && <p className="error">{error}</p>}
      {data && rated.length === 0 && <Empty />}
      {data && rated.length > 0 && (
        <>
          <div className="chart-box">
            <Bar
              data={{
                labels: data.hours.map((h) => pad(h.hour)),
                datasets: [
                  {
                    label: 'Average energy',
                    data: data.hours.map((h) => h.avgEnergy),
                    backgroundColor: SERIES_A,
                    borderRadius: { topLeft: 4, topRight: 4 },
                    borderSkipped: 'bottom',
                    maxBarThickness: 18,
                  },
                ],
              }}
              options={{
                scales: axes({ yMax: 5, yTitle: 'avg energy (1–5)' }),
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: (items) => `${items[0].label}:00–${pad((Number(items[0].label) + 1) % 24)}:00`,
                      label: (c) => ` ${c.raw ?? '—'}/5 avg over ${data.hours[c.dataIndex].count} logged hours`,
                    },
                  },
                },
              }}
            />
          </div>
          <DataTable columns={['Hour', 'Avg energy', 'Hours rated']} rows={data.hours.map((h) => [clock(h.hour), h.avgEnergy, h.count])} />
        </>
      )}
    </Card>
  );
}

// ---------- Sleep ----------
function SleepCard() {
  const [data, error] = useApi('/analytics/sleep');
  const nights = data ? data.nights.filter((n) => n.hours > 0) : [];
  const avg = (f) => (nights.length ? nights.reduce((s, n) => s + f(n), 0) / nights.length : null);
  const avgHours = avg((n) => n.hours);
  const avgBed = avg((n) => n.start);
  const avgWake = avg((n) => n.end);
  const lo = nights.length ? Math.min(...nights.map((n) => n.start)) - 1 : 20;
  const hi = nights.length ? Math.max(...nights.map((n) => n.end)) + 1 : 32;
  return (
    <Card
      title="Sleep pattern"
      subtitle={
        !data
          ? ' '
          : !data.category
            ? 'No "Sleep" category found.'
            : nights.length
              ? `Avg ${avgHours.toFixed(1)}h · usually asleep ~${clock(Math.round(avgBed))}, up ~${clock(Math.round(avgWake))} · last 30 nights`
              : 'From hours logged as Sleep · last 30 nights'
      }
    >
      {error && <p className="error">{error}</p>}
      {data && data.category && nights.length === 0 && <Empty>No sleep logged in the last 30 nights.</Empty>}
      {nights.length > 0 && (
        <>
          <div className="chart-box">
            <Bar
              data={{
                labels: data.nights.map((n) => shortDate(n.night)),
                datasets: [
                  {
                    label: 'Asleep',
                    data: data.nights.map((n) => (n.hours ? [n.start, n.end] : null)),
                    backgroundColor: data.category.color,
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 16,
                  },
                ],
              }}
              options={{
                scales: {
                  ...axes(),
                  y: {
                    reverse: true,
                    min: Math.max(12, lo),
                    max: Math.min(36, hi),
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    border: { display: false },
                    ticks: { stepSize: 2, callback: (v) => clock(v) },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: (items) => `Night of ${formatDate(data.nights[items[0].dataIndex].night)}`,
                      label: (c) => {
                        const n = data.nights[c.dataIndex];
                        const gap = n.end - n.start - n.hours;
                        return ` ${clock(n.start)} → ${clock(n.end)} · ${n.hours}h asleep${gap > 0 ? ` (${gap}h awake in between)` : ''}`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          <DataTable
            columns={['Night', 'Asleep', 'Woke', 'Hours']}
            rows={data.nights.map((n) => [shortDate(n.night), n.hours ? clock(n.start) : null, n.hours ? clock(n.end) : null, n.hours])}
          />
        </>
      )}
    </Card>
  );
}

// ---------- Week vs week ----------
function WeekCompareCard() {
  const [data, error] = useApi('/analytics/week-compare');
  return (
    <Card
      title="This week vs last week"
      subtitle={data ? `${data.a.total}h this week (w/c ${shortDate(data.a.start)}) vs ${data.b.total}h last week` : ' '}
    >
      {error && <p className="error">{error}</p>}
      {data && data.categories.length === 0 && <Empty />}
      {data && data.categories.length > 0 && (
        <>
          <div className="chart-box" style={{ height: Math.max(180, data.categories.length * 52 + 60) }}>
            <Bar
              data={{
                labels: data.categories.map((c) => c.name),
                datasets: [
                  { label: 'This week', data: data.categories.map((c) => c.a), backgroundColor: SERIES_A },
                  { label: 'Last week', data: data.categories.map((c) => c.b), backgroundColor: SERIES_B },
                ].map((d) => ({
                  ...d,
                  borderRadius: { topRight: 4, bottomRight: 4 },
                  borderSkipped: 'left',
                  borderColor: SURFACE,
                  borderWidth: { top: 1, bottom: 1 },
                  maxBarThickness: 16,
                })),
              }}
              options={{
                indexAxis: 'y',
                scales: {
                  x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, border: { display: false }, ticks: { precision: 0 } },
                  y: { grid: { display: false }, border: { display: false } },
                },
                interaction: { mode: 'index', intersect: false, axis: 'y' },
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: {
                    callbacks: {
                      label: (c) => ` ${c.dataset.label}: ${c.raw}h`,
                      footer: (items) => {
                        const d = data.categories[items[0].dataIndex].diff;
                        return d === 0 ? 'No change' : `${d > 0 ? '+' : ''}${d}h vs last week`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          <DataTable
            columns={['Category', 'This week', 'Last week', 'Change']}
            rows={data.categories.map((c) => [c.name, `${c.a}h`, `${c.b}h`, `${c.diff > 0 ? '+' : ''}${c.diff}h`])}
          />
        </>
      )}
    </Card>
  );
}

export default function Analytics() {
  const [streak] = useApi('/analytics/streaks');
  const serverClock = useClock();
  const year = serverClock ? Number(serverClock.today.slice(0, 4)) : null;
  return (
    <div className="page">
      <div className="page-head">
        <h1>Analytics</h1>
      </div>
      <div className="stats">
        <StatCard label="Current streak" value={streak ? `${streak.current}d` : '…'} hint="days with no unaccounted hours" tone={streak?.current ? 'good' : undefined} />
        <StatCard label="Longest streak" value={streak ? `${streak.longest}d` : '…'} hint={streak?.firstDate ? `since ${shortDate(streak.firstDate)}` : undefined} />
      </div>
      <CategoriesCard />
      {year && <HeatmapCard year={year} />}
      <EnergyCard />
      <SleepCard />
      <WeekCompareCard />
      <section className="card glass insights-placeholder">
        <h2>Reflection insights</h2>
        <p className="muted small">Reserved for a future feature. Your logs, plans and reflections are stored in a clean, structured form so insights can be added here later.</p>
      </section>
    </div>
  );
}
