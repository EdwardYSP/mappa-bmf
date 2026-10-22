import Link from 'next/link'
import type { ColumnDefinition } from '@/features/tables/queries'
import type { RowsPage } from '../queries'

type RowsTableProps = {
  tableId: string
  columns: ColumnDefinition[]
  page: RowsPage
  term: string
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

/** S2: la paginacion conserva el termino de busqueda; buscar resetea la pagina. */
function pageHref(tableId: string, page: number, term: string): string {
  const params = new URLSearchParams()
  if (term) params.set('q', term)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/tables/${tableId}?${query}` : `/tables/${tableId}`
}

export function RowsTable({ tableId, columns, page, term }: RowsTableProps) {
  if (page.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {term
          ? `La búsqueda no encontró coincidencias para “${term}”.`
          : 'Esta tabla todavía no tiene filas.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {columns.map((column) => (
                <th key={column.id} className="px-3 py-2 font-medium whitespace-nowrap">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((column) => (
                  <td key={column.id} className="px-3 py-2">
                    {formatCell(row.data[column.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {page.total} {page.total === 1 ? 'fila' : 'filas'} · página {page.page} de{' '}
          {page.pageCount}
        </span>
        <div className="flex gap-2">
          {page.page > 1 ? (
            <Link
              href={pageHref(tableId, page.page - 1, term)}
              className="rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Anterior
            </Link>
          ) : null}
          {page.page < page.pageCount ? (
            <Link
              href={pageHref(tableId, page.page + 1, term)}
              className="rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Siguiente
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  )
}
