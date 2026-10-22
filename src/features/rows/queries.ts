import { createClient } from '@/lib/supabase/server'
import { PAGE_SIZE } from '@/features/tables/queries'

export type RowRecord = {
  id: string
  data: Record<string, unknown>
}

export type RowsPage = {
  rows: RowRecord[]
  total: number
  page: number
  pageCount: number
}

/**
 * S4: en ILIKE, "%" y "_" son comodines. Sin escapar, buscar "50%" devuelve
 * cualquier cosa que empiece con 50. La barra invertida se escapa primero.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/** S2: una pagina de 25 filas, opcionalmente filtrada por el buscador. */
export async function listRows(
  tableId: string,
  options: { page?: number; q?: string } = {}
): Promise<RowsPage> {
  const supabase = await createClient()

  const q = (options.q ?? '').trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const from = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('rows')
    .select('id, data', { count: 'exact' })
    .eq('table_id', tableId)

  if (q) {
    query = query.ilike('search_text', `%${escapeLike(q)}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    throw new Error(`No se pudieron cargar las filas: ${error.message}`)
  }

  const total = count ?? 0

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      data: (row.data ?? {}) as Record<string, unknown>,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}
