import { Suspense } from 'react'
import { SearchForm } from '@/features/search/components/search-form'
import { SearchResults } from '@/features/search/components/search-results'
import { searchPublishedRows } from '@/features/search/queries'
import { TableList } from '@/features/tables/components/table-list'
import { listPublishedTables } from '@/features/tables/queries'

type HomePageProps = {
  searchParams: Promise<{ q?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Tablas públicas</h1>
        <p className="text-sm text-muted-foreground">
          Consultá el contenido sin necesidad de cuenta.
        </p>
      </header>

      <SearchForm action="/" placeholder="Buscar en todas las tablas…" defaultValue={term} />

      {/* S5: este fallback ES el indicador de carga. No se usa loading.tsx a
          proposito: un boundary a nivel de ruta fija el 200 y rompe el 404 de
          /tables/[id] cuando la tabla no existe. */}
      <Suspense
        key={term}
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Cargando…
          </p>
        }
      >
        {term ? <SearchSection term={term} /> : <TablesSection />}
      </Suspense>
    </main>
  )
}

async function TablesSection() {
  return <TableList tables={await listPublishedTables()} />
}

async function SearchSection({ term }: { term: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Resultados para “{term}”</h2>
      <SearchResults groups={await searchPublishedRows(term)} term={term} />
    </section>
  )
}
