import Link from 'next/link'
import { TableForm, type EditableColumn } from '@/features/tables/components/table-form'

const FIRST_COLUMN: EditableColumn = { key: 'inicial', id: null, name: '', type: 'text' }

export default function NewTablePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/dashboard" className="text-sm underline underline-offset-4">
          ← Tablas
        </Link>
        <h1 className="text-2xl font-semibold">Nueva tabla</h1>
        <p className="text-sm text-muted-foreground">
          Se crea oculta: publicala cuando esté completa.
        </p>
      </header>

      <TableForm
        tableId={null}
        name=""
        description=""
        status="hidden"
        columns={[FIRST_COLUMN]}
      />
    </main>
  )
}
