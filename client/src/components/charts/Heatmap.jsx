import { useEffect, useMemo, useRef, useState } from 'react';
import { SEQ_BLUE } from './setup';
import { formatDate } from '../../format';

const CELL = 12;
const GAP = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bins a value into the 5-step sequential ramp. null → no data.
function binHours(v) {
  if (v == null || v === 0) return -1;
  if (v <= 4) return 0;
  if (v <= 9) return 1;
  if (v <= 14) return 2;
  if (v <= 19) return 3;
  return 4;
}
function binPct(v) {
  if (v == null) return -1;
  return Math.min(4, Math.floor(v / 20));
}

// GitHub-style year heatmap (Monday-first columns). Tap or hover a cell to read it.
export default function Heatmap({ days, mode }) {
  const [active, setActive] = useState(null);
  const scroller = useRef(null);
  const { cells, weeks, monthLabels } = useMemo(() => {
    const first = new Date(`${days[0].date}T00:00:00Z`);
    const offset = (first.getUTCDay() + 6) % 7;
    const out = days.map((d, i) => {
      const idx = i + offset;
      return { ...d, col: Math.floor(idx / 7), row: idx % 7 };
    });
    const labels = [];
    out.forEach((c) => {
      if (c.date.endsWith('-01')) labels.push({ col: c.col, label: MONTHS[Number(c.date.slice(5, 7)) - 1] });
    });
    return { cells: out, weeks: out[out.length - 1].col + 1, monthLabels: labels };
  }, [days]);

  // On narrow screens, start scrolled to the latest weeks (today) rather than January.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const todayCell = cells.find((c) => c.state === 'today');
    const x = todayCell ? 24 + todayCell.col * (CELL + GAP) : el.scrollWidth;
    el.scrollLeft = Math.max(0, x - el.clientWidth + 48);
  }, [cells]);

  const width = weeks * (CELL + GAP) + 24;
  const height = 7 * (CELL + GAP) + 18;
  const bin = mode === 'alignment' ? (d) => binPct(d.alignmentPct) : (d) => binHours(d.logged);
  const describe = (d) => {
    if (d.state === 'future') return `${formatDate(d.date)}: not yet`;
    if (d.state === 'untracked') return `${formatDate(d.date)}: before tracking started`;
    return `${formatDate(d.date)}: ${d.logged}h logged · ${d.unaccounted}h unaccounted · ${
      d.alignmentPct == null ? 'no alignment data' : `${d.alignmentPct}% aligned`
    }`;
  };

  return (
    <div className="heatmap">
      <div className="heatmap-scroll" ref={scroller}>
        <svg width={width} height={height} role="img" aria-label={`Year heatmap of ${mode === 'alignment' ? 'alignment %' : 'hours logged'}`}>
          {monthLabels.map((m) => (
            <text key={m.label} x={24 + m.col * (CELL + GAP)} y={10} className="hm-label">
              {m.label}
            </text>
          ))}
          {['Mon', 'Wed', 'Fri'].map((d, i) => (
            <text key={d} x={0} y={18 + (i * 2) * (CELL + GAP) + CELL - 2} className="hm-label">
              {d}
            </text>
          ))}
          {cells.map((d) => {
            const b = d.state === 'past' || d.state === 'today' ? bin(d) : -2;
            const fill = b >= 0 ? SEQ_BLUE[b] : b === -1 ? 'rgba(255,255,255,0.06)' : 'transparent';
            return (
              <rect
                key={d.date}
                x={24 + d.col * (CELL + GAP)}
                y={16 + d.row * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={fill}
                stroke={active?.date === d.date ? '#fff' : b === -2 ? 'rgba(255,255,255,0.06)' : 'none'}
                strokeWidth={active?.date === d.date ? 1.5 : 1}
                onMouseEnter={() => setActive(d)}
                onClick={() => setActive(d)}
              >
                <title>{describe(d)}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="heatmap-foot">
        <span className="muted small hm-readout">{active ? describe(active) : 'Tap a day to see its numbers.'}</span>
        <span className="hm-legend">
          <span className="muted small">{mode === 'alignment' ? '0%' : 'Less'}</span>
          {SEQ_BLUE.map((c) => (
            <span key={c} className="hm-swatch" style={{ background: c }} />
          ))}
          <span className="muted small">{mode === 'alignment' ? '100%' : 'More'}</span>
        </span>
      </div>
    </div>
  );
}
