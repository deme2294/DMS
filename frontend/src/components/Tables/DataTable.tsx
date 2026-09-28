import styles from './DataTable.module.css';

type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyIcon?: React.ReactNode;
};

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  emptyTitle,
  emptySubtitle,
  emptyIcon,
}: Props<T>) {
  if (loading) return <div className={styles.loading}>Loading...</div>;

  const title = emptyTitle || emptyMessage || 'No records found';
  const subtitle = emptySubtitle || (emptyTitle ? emptyMessage : 'There are no entries to display at this time.');

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                <div className={styles.emptyContainer}>
                  <div className={styles.emptyIconWrapper}>
                    {emptyIcon || (
                      <svg
                        className={styles.emptySvg}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                        <circle cx="12" cy="13" r="2.5" />
                        <path d="m14 15 2.5 2.5" />
                      </svg>
                    )}
                  </div>
                  <h4 className={styles.emptyTitle}>{title}</h4>
                  <p className={styles.emptySubtitle}>{subtitle}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}