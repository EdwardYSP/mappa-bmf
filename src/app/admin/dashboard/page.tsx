import Link from 'next/link'
import { listAllTables } from '@/features/tables/admin-queries'
import { DeleteTableForm } from '@/features/tables/components/delete-table-form'

type DashboardPageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>
}

const OK_MESSAGES: Record<string, string> = {
  creada: 'Tabla creada.',
  actualizada: 'Cambios guardados.',
  eliminada: 'Tabla eliminada.',
}

export default async function AdminDashboardPage({ searchParams }: DashboardPageProps) {
  const { ok, error } = await searchParams
  const tables = await listAllTables()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tablas</h1>
        <Link
          href="/admin/tables/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Nueva tabla
        </Link>
      </header>

      {ok && OK_MESSAGES[ok] ? (
        <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          {OK_MESSAGES[ok]}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          No se pudo completar la operación. Intentá de nuevo.
        </p>
      ) : null}

      {tables.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no hay tablas. Creá la primera.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{table.name}</span>
                  <span
                    className={
                      table.status === 'published'
                        ? 'rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs'
                        : 'rounded-full border px-2 py-0.5 text-xs text-muted-foreground'
                    }
                  >
                    {table.status === 'published' ? 'Publicada' : 'Oculta'}
                  </span>
                </div>
                {table.description ? (
                  <p className="text-sm text-muted-foreground">{table.description}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/admin/tables/${table.id}/rows`}
                  className="rounded-md border px-3 py-1.5 hover:bg-muted"
                >
                  Registros
                </Link>
                <Link
                  href={`/admin/tables/${table.id}/edit`}
                  className="rounded-md border px-3 py-1.5 hover:bg-muted"
                >
                  Editar
                </Link>
                <DeleteTableForm tableId={table.id} tableName={table.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
