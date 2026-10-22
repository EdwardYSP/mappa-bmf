import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** INDEX-5.1: una sola constante, compartida por el panel publico y el admin. */
export const PAGE_SIZE = 25

export type PublishedTable = {
  id: string
  name: string
  description: string
}

export type ColumnDefinition = {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'boolean'
  position: number
}

export type TableWithColumns = PublishedTable & { columns: ColumnDefinition[] }

// PostgREST responde 22P02 si el id no es un uuid; se valida antes de consultar.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * S1: el panel publico nunca muestra tablas ocultas, ni siquiera cuando quien
 * mira es un admin. RLS dejaria pasar las ocultas para un admin, asi que el
 * filtro explicito es lo que hace que la vista sea igual para todos.
 */
export async function listPublishedTables(): Promise<PublishedTable[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, name, description')
    .eq('status', 'published')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar las tablas: ${error.message}`)
  }

  return data ?? []
}

/** S2: tabla publicada con sus columnas en orden. Cualquier otra cosa es 404. */
export async function getPublishedTable(id: string): Promise<TableWithColumns> {
  if (!isUuid(id)) {
    notFound()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, name, description, columns(id, name, type, position)')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar la tabla: ${error.message}`)
  }

  if (!data) {
    notFound()
  }

  const columns = [...(data.columns ?? [])].sort((a, b) => a.position - b.position)

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    columns,
  }
}
