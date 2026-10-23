'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ColumnDefinition } from '@/features/tables/queries'
import { createRow, updateRow, type RowState } from '../actions'

type RowFormProps = {
  tableId: string
  columns: ColumnDefinition[]
  submitLabel: string
  rowId?: string
  initialData?: Record<string, unknown>
}

const INITIAL_STATE: RowState = { status: 'idle', message: null }

/**
 * S4: el formulario se genera a partir de las columnas definidas, y valida en
 * el navegador por comodidad (tipos nativos de input). La validacion que cuenta
 * es la del servidor, que ademas vuelve a leer las columnas de la base.
 */
export function RowForm({
  tableId,
  columns,
  submitLabel,
  rowId,
  initialData = {},
}: RowFormProps) {
  const [state, formAction, isPending] = useActionState(
    rowId ? updateRow : createRow,
    INITIAL_STATE
  )

  const scope = rowId ?? 'nuevo'

  return (
    <form action={formAction} autoComplete="off" className="flex flex-col gap-3">
      <input type="hidden" name="tableId" value={tableId} />
      {rowId ? <input type="hidden" name="rowId" value={rowId} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {columns.map((column) => {
          const fieldId = `${scope}-${column.id}`
          const current = initialData[column.name]

          if (column.type === 'boolean') {
            return (
              <div key={column.id} className="flex items-center gap-2">
                <input
                  id={fieldId}
                  name={column.name}
                  type="checkbox"
                  defaultChecked={current === true}
                  disabled={isPending}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor={fieldId}>{column.name}</Label>
              </div>
            )
          }

          // Los numeros se piden como texto: con type="number" el navegador
          // bloquea las letras sin explicar nada y acepta "e" (notacion
          // cientifica), asi que el mensaje de validacion del servidor nunca se
          // llega a ver. Con inputMode el teclado del celular sigue siendo
          // numerico.
          const inputType = column.type === 'date' ? 'date' : 'text'

          return (
            <div key={column.id} className="flex flex-col gap-1">
              <Label htmlFor={fieldId}>{column.name}</Label>
              <Input
                id={fieldId}
                name={column.name}
                type={inputType}
                inputMode={column.type === 'number' ? 'decimal' : undefined}
                autoComplete="off"
                defaultValue={
                  current === null || current === undefined ? '' : String(current)
                }
                disabled={isPending}
              />
            </div>
          )
        })}
      </div>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
