import { createClient } from '@/lib/supabase/server'
import { escapeLike } from '@/features/rows/queries'

/** SRCH-2.1: cinco coincidencias por tabla y sin paginacion global. */
export const PER_TABLE_LIMIT = 5

// Techo de filas que se traen para agrupar. PostgREST no tiene "limit por
// grupo"; agrupar en memoria es mas simple y suficiente a esta escala.
const FETCH_LIMIT = 200

export type SearchHit = {
  rowId: string
  data: Record<string, unknown>
}

export type TableSearchGroup = {
  tableId: string
  tableName: string
  hits: SearchHit[]
}

type EmbeddedTable = {
  id: string
  name: string
  status: string
}

function firstTable(value: EmbeddedTable | EmbeddedTable[] | null): EmbeddedTable | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** S3: busqueda global sobre tablas publicadas, agrupada por tabla. */
export async function searchPublishedRows(term: string): Promise<TableSearchGroup[]> {
  const q = term.trim()
  if (!q) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rows')
    .select('id, table_id, data, tables!inner(id, name, status)')
    .eq('tables.status', 'published')
    .ilike('search_text', `%${escapeLike(q)}%`)
    .order('table_id', { ascending: true })
    .limit(FETCH_LIMIT)

  if (error) {
    throw new Error(`No se pudo buscar: ${error.message}`)
  }

  const groups = new Map<string, TableSearchGroup>()

  for (const row of data ?? []) {
    const table = firstTable(row.tables as EmbeddedTable | EmbeddedTable[] | null)
    if (!table) continue

    const group = groups.get(table.id) ?? {
      tableId: table.id,
      tableName: table.name,
      hits: [],
    }

    if (group.hits.length < PER_TABLE_LIMIT) {
      group.hits.push({
        rowId: row.id,
        data: (row.data ?? {}) as Record<string, unknown>,
      })
    }

    groups.set(table.id, group)
  }

  return [...groups.values()].sort((a, b) => a.tableName.localeCompare(b.tableName))
}
