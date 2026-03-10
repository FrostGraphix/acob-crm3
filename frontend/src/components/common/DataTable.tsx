import type { ActionConfig, DataRow, TableColumn } from "../../types";

interface DataTableProps {
  columns: TableColumn[];
  rows: DataRow[];
  rowActions?: ActionConfig[];
  selectedKeys: string[];
  pageNumber: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onToggleAll: () => void;
  onToggleRow: (row: DataRow) => void;
  onRowAction: (action: ActionConfig, row: DataRow) => void;
  onPageChange: (pageNumber: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  getRowKey: (row: DataRow) => string;
}

function renderValue(value: DataRow[string]) {
  if (value === null) {
    return "--";
  }

  return String(value);
}

export function DataTable({
  columns,
  rows,
  rowActions = [],
  selectedKeys,
  pageNumber,
  pageSize,
  total,
  loading,
  onToggleAll,
  onToggleRow,
  onRowAction,
  onPageChange,
  onPageSizeChange,
  getRowKey,
}: DataTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedKeys.includes(getRowKey(row)));

  return (
    <section className="table-panel">
      <div className="table-meta">
        <strong>Total {total}</strong>
        <div className="table-pagination">
          <label>
            <span>Per page</span>
            <select
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-ghost"
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
            type="button"
          >
            Prev
          </button>
          <span>
            Page {pageNumber} / {pageCount}
          </span>
          <button
            className="button button-ghost"
            disabled={pageNumber >= pageCount}
            onClick={() => onPageChange(pageNumber + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input checked={allVisibleSelected} onChange={onToggleAll} type="checkbox" />
              </th>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              {rowActions.length > 0 ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + 2}>
                  Loading records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + 2}>
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowKey = getRowKey(row);

                return (
                  <tr key={rowKey}>
                    <td>
                      <input
                        checked={selectedKeys.includes(rowKey)}
                        onChange={() => onToggleRow(row)}
                        type="checkbox"
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        className={`cell-align-${column.align ?? "start"}`}
                        key={`${rowKey}-${column.key}`}
                      >
                        {renderValue(row[column.key])}
                      </td>
                    ))}
                    {rowActions.length > 0 ? (
                      <td className="row-actions">
                        {rowActions.map((action) => (
                          <button
                            className={`mini-button mini-button-${action.tone ?? "neutral"}`}
                            key={action.key}
                            onClick={() => onRowAction(action, row)}
                            type="button"
                          >
                            {action.label}
                          </button>
                        ))}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
