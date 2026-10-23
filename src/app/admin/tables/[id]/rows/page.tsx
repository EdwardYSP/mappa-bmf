import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteRowForm } from '@/features/rows/components/delete-row-form'
import { RowForm } from '@/features/rows/components/row-form'
import { listRows } from '@/features/rows/queries'
import { getTableForAdmin } from '@/features/tables/admin-queries'

type RowsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; ok?: string; error?: string }>
}

const OK_MESSAGES: Record<string, string> = {
  creado: 'Registro creado.',
  actualizado: 'Registro actualizado.',
  eliminado: 'Registro eliminado.',
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

export default async function RowsPage({ params, searchParams }: RowsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])

  const table = await getTableForAdmin(id)
  if (!table) {
    notFound()
  }

  const page = Number.parseInt(query.page ?? '1', 10) || 1
  const rows = await listRows(table.id, { page })

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/dashboard" className="text-sm underline underline-offset-4">
          ← Tablas
        </Link>
        <h1 className="text-2xl font-semibold">Registros de “{table.name}”</h1>
        <Link
          href={`/admin/tables/${table.id}/edit`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Editar la definición de la tabla →
        </Link>
      </header>

      {query.ok && OK_MESSAGES[query.ok] ? (
        <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          {OK_MESSAGES[query.ok]}
        </p>
      ) : null}

      {query.ok === 'error' || query.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          No se pudo completar la operación. Intentá de nuevo.
        </p>
      ) : null}

      {table.columns.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          La tabla no tiene columnas definidas: agregalas desde “Editar”.
        </p>
      ) : (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Agregar registro</summary>
          <div className="pt-4">
            <RowForm tableId={table.id} columns={table.columns} submitLabel="Agregar" />
          </div>
        </details>
      )}

      {rows.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Esta tabla todavía no tiene registros.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.rows.map((row) => (
            <li key={row.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <dl className="grid flex-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {table.columns.map((column) => (
                    <div key={column.id} className="flex gap-2">
                      <dt className="text-muted-foreground">{column.name}:</dt>
                      <dd>{formatCell(row.data[column.name])}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex items-center gap-2 text-sm">
                  <DeleteRowForm tableId={table.id} rowId={row.id} />
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm underline underline-offset-4">
                  Editar registro
                </summary>
                <div className="pt-3">
                  <RowForm
                    tableId={table.id}
                    columns={table.columns}
                    rowId={row.id}
                    initialData={row.data}
                    submitLabel="Guardar cambios"
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {rows.total} {rows.total === 1 ? 'registro' : 'registros'} · página {rows.page} de{' '}
          {rows.pageCount}
        </span>
        <div className="flex gap-2">
          {rows.page > 1 ? (
            <Link
              href={`/admin/tables/${table.id}/rows?page=${rows.page - 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Anterior
            </Link>
          ) : null}
          {rows.page < rows.pageCount ? (
            <Link
              href={`/admin/tables/${table.id}/rows?page=${rows.page + 1}`}
              className="rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Siguiente
            </Link>
          ) : null}
        </div>
      </nav>
    </main>
  )
}
