'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SaveTableState = {
  status: 'idle' | 'error'
  message: string | null
}

const COLUMN_TYPES = ['text', 'number', 'date', 'boolean'] as const
type ColumnType = (typeof COLUMN_TYPES)[number]

type SubmittedColumn = {
  id: string | null
  name: string
  type: ColumnType
  position: number
}

/** S2 + S4: el servidor vuelve a validar todo lo que llega del formulario. */
function parseColumns(raw: string): SubmittedColumn[] | string {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return 'No se pudieron leer las columnas del formulario.'
  }

  if (!Array.isArray(parsed)) {
    return 'No se pudieron leer las columnas del formulario.'
  }

  const columns: SubmittedColumn[] = []

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      return 'Hay una columna con datos inválidos.'
    }

    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const type = record.type

    if (!name) {
      return 'Cada columna necesita un nombre.'
    }

    if (typeof type !== 'string' || !COLUMN_TYPES.includes(type as ColumnType)) {
      return `El tipo de la columna “${name}” no es válido.`
    }

    columns.push({
      id: typeof record.id === 'string' && record.id ? record.id : null,
      name,
      type: type as ColumnType,
      position: columns.length + 1,
    })
  }

  if (columns.length === 0) {
    return 'La tabla necesita al menos una columna.'
  }

  const names = new Set<string>()
  for (const column of columns) {
    const key = column.name.toLowerCase()
    if (names.has(key)) {
      return `Hay dos columnas llamadas “${column.name}”.`
    }
    names.add(key)
  }

  return columns
}

/** S3: mensajes comprensibles, nunca el error crudo de PostgreSQL. */
function mapDatabaseError(code: string | undefined, message: string): string {
  if (code === '23505') {
    if (message.includes('tables_name_lower_key')) return 'Ya existe una tabla con ese nombre.'
    if (message.includes('columns_table_name_key')) return 'Hay dos columnas con el mismo nombre.'
    if (message.includes('columns_table_position_key')) return 'Hay dos columnas en la misma posición.'
  }

  // Nuestros propios raise exception usan 22023 y ya traen texto presentable.
  if (code === '22023') return message
  if (code === 'P0002') return 'La tabla ya no existe.'

  return 'No se pudo guardar la tabla. Intentá de nuevo.'
}

/** S2 + S6: crear o editar una tabla con sus columnas, en una sola transaccion. */
export async function saveTable(
  _previous: SaveTableState,
  formData: FormData
): Promise<SaveTableState> {
  const tableId = String(formData.get('tableId') ?? '').trim() || null
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const status = String(formData.get('status') ?? '') === 'published' ? 'published' : 'hidden'

  if (!name) {
    return { status: 'error', message: 'El nombre de la tabla es obligatorio.' }
  }

  const columns = parseColumns(String(formData.get('columns') ?? ''))
  if (typeof columns === 'string') {
    return { status: 'error', message: columns }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('save_table_with_columns', {
    // El generador de tipos marca p_table_id como string no nulo; en la base es
    // uuid y null significa "crear".
    p_table_id: tableId as string,
    p_name: name,
    p_description: description,
    p_status: status,
    p_columns: columns,
  })

  if (error) {
    return { status: 'error', message: mapDatabaseError(error.code, error.message) }
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/')
  redirect(`/admin/dashboard?ok=${tableId ? 'actualizada' : 'creada'}`)
}

/** S5: se llama solo despues de la confirmacion del usuario en el navegador. */
export async function deleteTable(formData: FormData): Promise<void> {
  const id = String(formData.get('tableId') ?? '').trim()

  if (!id) {
    redirect('/admin/dashboard?error=sin-id')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tables').delete().eq('id', id)

  revalidatePath('/admin/dashboard')
  revalidatePath('/')

  if (error) {
    redirect('/admin/dashboard?error=eliminar')
  }

  redirect('/admin/dashboard?ok=eliminada')
}
