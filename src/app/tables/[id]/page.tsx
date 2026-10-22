import Link from 'next/link'
import { Suspense } from 'react'
import { RowsTable } from '@/features/rows/components/rows-table'
import { listRows } from '@/features/rows/queries'
import { SearchForm } from '@/features/search/components/search-form'
import { getPublishedTable, type ColumnDefinition } from '@/features/tables/queries'

type TablePageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function TablePage({ params, searchParams }: TablePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])

  // S2: la existencia se resuelve ANTES de cualquier boundary de Suspense.
  // Si no existe o esta oculta, notFound() responde 404 real; si se envolviera
  // en un loading.tsx, el 200 ya estaria enviado y el status seria incorrecto.
  const table = await getPublishedTable(id)

  const term = (query.q ?? '').trim()
  const page = Number.parseInt(query.page ?? '1', 10) || 1

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm underline underline-offset-4">
          ← Todas las tablas
        </Link>
        <h1 className="text-2xl font-semibold">{table.name}</h1>
        {table.description ? (
          <p className="text-sm text-muted-foreground">{table.description}</p>
        ) : null}
      </header>

      <SearchForm
        action={`/tables/${table.id}`}
        placeholder={`Buscar en ${table.name}…`}
        defaultValue={term}
      />

      <Suspense
        key={`${term}:${page}`}
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Cargando filas…
          </p>
        }
      >
        <RowsSection tableId={table.id} columns={table.columns} term={term} page={page} />
      </Suspense>
    </main>
  )
}

async function RowsSection({
  tableId,
  columns,
  term,
  page,
}: {
  tableId: string
  columns: ColumnDefinition[]
  term: string
  page: number
}) {
  const rows = await listRows(tableId, { page, q: term })
  return <RowsTable tableId={tableId} columns={columns} page={rows} term={term} />
}
