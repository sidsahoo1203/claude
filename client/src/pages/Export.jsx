import { useState } from 'react';

export default function Export() {
  const [downloading, setDownloading] = useState('');

  return (
    <div className="page">
      <div className="page-head">
        <h1>Export & backup</h1>
      </div>

      <section className="card glass stack">
        <h2>Download your data</h2>
        <p className="muted small">Your data stays yours. Downloads include everything you've recorded.</p>
        <div className="export-grid">
          <a className="export-option" href="/api/export/json" download onClick={() => setDownloading('json')}>
            <span className="export-icon">{'{ }'}</span>
            <span className="stack tight">
              <strong>Everything (JSON)</strong>
              <span className="muted small">
                Categories, time logs with notes, plan revisions, goal history, Stop Doing items, reflections and letters.
                Sealed letters are included without their text until they open.
              </span>
            </span>
          </a>
          <a className="export-option" href="/api/export/blocks.csv" download onClick={() => setDownloading('csv')}>
            <span className="export-icon">CSV</span>
            <span className="stack tight">
              <strong>Time logs (CSV)</strong>
              <span className="muted small">One row per logged hour, including category, energy, alignment, relapse, how late it was logged, and notes. Opens in Excel or Sheets.</span>
            </span>
          </a>
        </div>
        {downloading && <p className="muted small">Your download should start shortly.</p>}
      </section>

      <section className="card glass stack">
        <h2>Full database backup</h2>
        <p className="muted small">
          On the computer running the server, this saves a complete <code>mongodump</code> (including sealed letters) to a
          timestamped folder in <code>backups/</code>:
        </p>
        <pre className="code">npm run backup</pre>
        <p className="muted small">
          Needs MongoDB Database Tools installed. Restore with <code>mongorestore --uri=&lt;uri&gt; backups/&lt;folder&gt;</code>.
        </p>
      </section>
    </div>
  );
}
