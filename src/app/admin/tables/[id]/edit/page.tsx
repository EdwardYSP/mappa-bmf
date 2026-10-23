import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTableForAdmin } from '@/features/tables/admin-queries'
import { TableForm, type EditableColumn } from '@/features/tables/components/table-form'

type EditTablePageProps = {
  params: Promise<{ id: string }>
}

export default async function EditTablePage({ params }: EditTablePageProps) {
  const { id } = await params
  const table = await getTableForAdmin(id)

  if (!table) {
    notFound()
  }

  const columns: EditableColumn[] = table.columns.map((column) => ({
    key: column.id,
    id: column.id,
    name: column.name,
    type: column.type,
  }))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/dashboard" className="text-sm underline underline-offset-4">
          ← Tablas
        </Link>
        <h1 className="text-2xl font-semibold">Editar “{table.name}”</h1>
        <Link
          href={`/admin/tables/${table.id}/rows`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Gestionar registros →
        </Link>
      </header>

      <TableForm
        tableId={table.id}
        name={table.name}
        description={table.description}
        status={table.status}
        columns={columns}
      />
    </main>
  )
}
