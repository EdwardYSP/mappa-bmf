import Link from 'next/link'
import type { TableSearchGroup } from '../queries'

type SearchResultsProps = {
  groups: TableSearchGroup[]
  term: string
}

function preview(data: Record<string, unknown>): string {
  const values = Object.values(data)
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => (typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)))

  return values.join(' · ')
}

/** S3 + S5: coincidencias agrupadas por tabla, con su estado vacio propio. */
export function SearchResults({ groups, term }: SearchResultsProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        La búsqueda no encontró coincidencias para “{term}”.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.tableId} className="rounded-lg border p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{group.tableName}</h2>
            <Link
              href={`/tables/${group.tableId}?q=${encodeURIComponent(term)}`}
              className="text-sm underline underline-offset-4"
            >
              Ver todas en esta tabla
            </Link>
          </header>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {group.hits.map((hit) => (
              <li key={hit.rowId}>{preview(hit.data) || '(fila vacía)'}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
