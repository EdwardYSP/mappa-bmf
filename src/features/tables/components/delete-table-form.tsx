'use client'

import { Button } from '@/components/ui/button'
import { deleteTable } from '../actions'

/** S5: la confirmacion ocurre antes de que la accion llegue al servidor. */
export function DeleteTableForm({ tableId, tableName }: { tableId: string; tableName: string }) {
  return (
    <form
      action={deleteTable}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar la tabla “${tableName}” y todas sus filas? No se puede deshacer.`
        )
        if (!confirmed) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="tableId" value={tableId} />
      <Button type="submit" variant="outline">
        Eliminar
      </Button>
    </form>
  )
}
