/**
 * DataTable — reusable sortable table shell.
 * Server component wrapper providing consistent table styling.
 * For client-side sorting, wrap in a client component.
 */

interface Column {
  key: string
  label: string
  width?: string
  className?: string
}

interface Props {
  columns: Column[]
  children: React.ReactNode
  emptyMessage?: string
  isEmpty?: boolean
}

export default function DataTable({ columns, children, emptyMessage = 'No data', isEmpty = false }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="rw-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={col.className}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-gray-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
