import { createClient } from '@/lib/supabase/server'
import type { ColumnDefinition } from './queries'
import { isUuid } from './queries'

export type AdminTable = {
  id: string
  name: string
  description: string
  status: 'published' | 'hidden'
  updated_at: string
}

export type AdminTableWithColumns = AdminTable & { columns: ColumnDefinition[] }

/** S1: el admin ve todas las tablas. RLS es quien lo autoriza. */
export async function listAllTables(): Promise<AdminTable[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, name, description, status, updated_at')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar las tablas: ${error.message}`)
  }

  return data ?? []
}

/** S2: definicion completa de una tabla, publicada u oculta. */
export async function getTableForAdmin(id: string): Promise<AdminTableWithColumns | null> {
  if (!isUuid(id)) return null

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, name, description, status, updated_at, columns(id, name, type, position)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar la tabla: ${error.message}`)
  }

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    status: data.status,
    updated_at: data.updated_at,
    columns: [...(data.columns ?? [])].sort((a, b) => a.position - b.position),
  }
}
