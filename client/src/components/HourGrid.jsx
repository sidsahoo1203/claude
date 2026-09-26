import { ALIGNMENT, hourRange } from '../format';

const STATUS_TEXT = {
  open: 'Tap to log',
  future: 'Not yet',
  unaccounted: 'Unaccounted',
};

export default function HourGrid({ hours, onSelect, currentHour, showDate }) {
  return (
    <ol className="hour-grid">
      {hours.map((h) => {
        const b = h.block;
        const isNow = currentHour === h.hour && h.status === 'future';
        return (
          <li key={`${h.date || ''}-${h.hour}`}>
            <button
              className={`hour-row status-${h.status} ${isNow ? 'is-now' : ''}`}
              onClick={() => onSelect(h)}
              style={b ? { '--cat': b.category?.color } : undefined}
            >
              <span className="hour-time">
                {showDate && <span className="hour-date">{showDate(h)}</span>}
                {hourRange(h.hour)}
              </span>
              {b ? (
                <span className="hour-main">
                  <span className="hour-activity">{b.activity}</span>
                  <span className="hour-meta">
                    <span className="cat-chip">
                      <span className="dot" />
                      {b.category?.name}
                    </span>
                    <span className="energy" title={`Energy ${b.energy}/5`}>
                      {'●'.repeat(b.energy)}
                      <span className="energy-off">{'●'.repeat(5 - b.energy)}</span>
                    </span>
                    <span className={`align ${ALIGNMENT[b.alignment].cls}`} title={ALIGNMENT[b.alignment].label}>
                      {ALIGNMENT[b.alignment].short}
                    </span>
                    {b.notes?.length > 0 && <span className="muted small">✎ {b.notes.length}</span>}
                    {b.stopDoingItem && <span className="relapse-chip">relapse</span>}
                  </span>
                </span>
              ) : (
                <span className="hour-main hour-empty">{isNow ? 'In progress' : STATUS_TEXT[h.status]}</span>
              )}
              <span className="hour-lock" aria-hidden>
                {b ? '🔒' : h.status === 'unaccounted' ? '⦸' : ''}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
