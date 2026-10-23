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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * S4: en ILIKE, "%" y "_" son comodines. Sin escapar, buscar "50%" devuelve
 * cualquier cosa que empiece con 50. La barra invertida se escapa primero.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function buildQuery(supabase: SupabaseClient, tableId: string, term: string, page: number) {
  const from = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('rows')
    .select('id, data', { count: 'exact' })
    .eq('table_id', tableId)

  if (term) {
    query = query.ilike('search_text', `%${escapeLike(term)}%`)
  }

  return query.order('created_at', { ascending: true }).range(from, from + PAGE_SIZE - 1)
}

async function countRows(
  supabase: SupabaseClient,
  tableId: string,
  term: string
): Promise<number> {
  let query = supabase
    .from('rows')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', tableId)

  if (term) {
    query = query.ilike('search_text', `%${escapeLike(term)}%`)
  }

  const { count, error } = await query
  return error ? 0 : (count ?? 0)
}

/** S2: una pagina de 25 filas, opcionalmente filtrada por el buscador. */
export async function listRows(
  tableId: string,
  options: { page?: number; q?: string } = {}
): Promise<RowsPage> {
  const supabase = await createClient()

  const term = (options.q ?? '').trim()
  let page = Math.max(1, Math.trunc(options.page ?? 1))

  let result = await buildQuery(supabase, tableId, term, page)

  /**
   * Pedir una pagina que no existe tiene DOS comportamientos distintos:
   *   - offset MAYOR que el total -> 416 (PGRST103, "Requested range not
   *     satisfiable"), que supabase-js entrega como error;
   *   - offset IGUAL al total    -> 206 con lista vacia y sin error, que la
   *     vista interpretaria como "esta tabla no tiene filas" (mentira).
   * Pasa pidiendo ?page=99, o de forma normal: borrando filas mientras alguien
   * mira la ultima pagina. En ambos casos se corrige a la ultima pagina valida;
   * el conteo extra solo se paga cuando falta (caso 416).
   */
  const fueraDeRango =
    result.error?.code === 'PGRST103' ||
    ((result.data?.length ?? 0) === 0 && page > 1 && (result.count ?? 0) > 0)

  if (fueraDeRango) {
    const total = result.count ?? (await countRows(supabase, tableId, term))
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

    if (lastPage !== page) {
      page = lastPage
      result = await buildQuery(supabase, tableId, term, page)
    }
  }

  if (result.error) {
    throw new Error(`No se pudieron cargar las filas: ${result.error.message}`)
  }

  const total = result.count ?? 0

  return {
    rows: (result.data ?? []).map((row) => ({
      id: row.id,
      data: (row.data ?? {}) as Record<string, unknown>,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}
