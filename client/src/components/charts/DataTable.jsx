// Accessible table view for a chart (identity never relies on colour alone).
export default function DataTable({ columns, rows }) {
  return (
    <details className="data-table">
      <summary>Show data table</summary>
      <div className="table-wrap">
        <table className="week-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
