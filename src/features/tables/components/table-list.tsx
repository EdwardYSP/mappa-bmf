import Link from 'next/link'
import type { PublishedTable } from '../queries'

/** S1 + S5: lista de tablas publicadas, con su estado vacio propio. */
export function TableList({ tables }: { tables: PublishedTable[] }) {
  if (tables.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay tablas publicadas.
      </p>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {tables.map((table) => (
        <li key={table.id}>
          <Link
            href={`/tables/${table.id}`}
            className="flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <h2 className="font-medium">{table.name}</h2>
            {table.description ? (
              <p className="text-sm text-muted-foreground">{table.description}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
