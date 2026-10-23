import type { ColumnDefinition } from '@/features/tables/queries'

export type DataValue = string | number | boolean

export type ValidationResult =
  | { ok: true; data: Record<string, DataValue> }
  | { ok: false; message: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * UI-3 + S4: la validacion de tipos vive en el servidor, contra las columnas
 * reales de la base. El formulario tambien valida, pero solo por comodidad:
 * lo que importa es esto. Los campos vacios se omiten en vez de guardarse como
 * cadena vacia, para que "sin dato" sea "sin clave" (y el panel muestre vacio).
 */
export function validateRowData(
  columns: ColumnDefinition[],
  formData: FormData
): ValidationResult {
  const data: Record<string, DataValue> = {}

  for (const column of columns) {
    const raw = formData.get(column.name)

    if (column.type === 'boolean') {
      data[column.name] = raw === 'on' || raw === 'true'
      continue
    }

    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value === '') continue

    if (column.type === 'number') {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        return { ok: false, message: `“${column.name}” debe ser un número.` }
      }
      data[column.name] = parsed
      continue
    }

    if (column.type === 'date') {
      if (!DATE_RE.test(value)) {
        return { ok: false, message: `“${column.name}” debe ser una fecha (AAAA-MM-DD).` }
      }
      data[column.name] = value
      continue
    }

    data[column.name] = value
  }

  return { ok: true, data }
}
