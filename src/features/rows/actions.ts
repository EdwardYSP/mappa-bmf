'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ColumnDefinition } from '@/features/tables/queries'
import { validateRowData } from './validation'

export type RowState = {
  status: 'idle' | 'error'
  message: string | null
}

/** Las columnas se leen del servidor: el formulario no dicta el esquema. */
async function loadColumns(tableId: string): Promise<ColumnDefinition[] | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, columns(id, name, type, position)')
    .eq('id', tableId)
    .maybeSingle()

  if (error || !data) return null

  return [...(data.columns ?? [])].sort((a, b) => a.position - b.position)
}

function tablePath(tableId: string, ok: string): string {
  return `/admin/tables/${tableId}/rows?ok=${ok}`
}

export async function createRow(
  _previous: RowState,
  formData: FormData
): Promise<RowState> {
  const tableId = String(formData.get('tableId') ?? '').trim()
  if (!tableId) return { status: 'error', message: 'Falta la tabla.' }

  const columns = await loadColumns(tableId)
  if (!columns) return { status: 'error', message: 'La tabla ya no existe.' }

  const result = validateRowData(columns, formData)
  if (!result.ok) return { status: 'error', message: result.message }

  const supabase = await createClient()
  const { error } = await supabase.from('rows').insert({ table_id: tableId, data: result.data })

  if (error) {
    return { status: 'error', message: 'No se pudo guardar el registro. Intentá de nuevo.' }
  }

  revalidatePath(`/admin/tables/${tableId}/rows`)
  revalidatePath(`/tables/${tableId}`)
  revalidatePath('/')
  redirect(tablePath(tableId, 'creado'))
}

export async function updateRow(
  _previous: RowState,
  formData: FormData
): Promise<RowState> {
  const tableId = String(formData.get('tableId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()

  if (!tableId || !rowId) return { status: 'error', message: 'Falta el registro.' }

  const columns = await loadColumns(tableId)
  if (!columns) return { status: 'error', message: 'La tabla ya no existe.' }

  const result = validateRowData(columns, formData)
  if (!result.ok) return { status: 'error', message: result.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('rows')
    .update({ data: result.data })
    .eq('id', rowId)
    .eq('table_id', tableId)

  if (error) {
    return { status: 'error', message: 'No se pudo guardar el registro. Intentá de nuevo.' }
  }

  revalidatePath(`/admin/tables/${tableId}/rows`)
  revalidatePath(`/tables/${tableId}`)
  revalidatePath('/')
  redirect(tablePath(tableId, 'actualizado'))
}

/** S5: la confirmacion ocurre en el navegador antes de llegar aca. */
export async function deleteRow(formData: FormData): Promise<void> {
  const tableId = String(formData.get('tableId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()

  if (!tableId || !rowId) {
    redirect(`/admin/tables/${tableId}/rows?error=si`)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('rows').delete().eq('id', rowId).eq('table_id', tableId)

  revalidatePath(`/admin/tables/${tableId}/rows`)
  revalidatePath(`/tables/${tableId}`)
  revalidatePath('/')

  redirect(tablePath(tableId, error ? 'error' : 'eliminado'))
}
