'use client'

import { Button } from '@/components/ui/button'
import { deleteRow } from '../actions'

/** S5: confirmacion antes de borrar el registro. */
export function DeleteRowForm({ tableId, rowId }: { tableId: string; rowId: string }) {
  return (
    <form
      action={deleteRow}
      onSubmit={(event) => {
        const confirmed = window.confirm('¿Eliminar este registro? No se puede deshacer.')
        if (!confirmed) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="rowId" value={rowId} />
      <Button type="submit" variant="outline">
        Eliminar
      </Button>
    </form>
  )
}
