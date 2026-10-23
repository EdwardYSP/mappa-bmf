'use client'

import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveTable, type SaveTableState } from '../actions'

export type EditableColumn = {
  key: string
  id: string | null
  name: string
  type: 'text' | 'number' | 'date' | 'boolean'
}

type TableFormProps = {
  tableId: string | null
  name: string
  description: string
  status: 'published' | 'hidden'
  columns: EditableColumn[]
}

const INITIAL_STATE: SaveTableState = { status: 'idle', message: null }

const COLUMN_TYPES: EditableColumn['type'][] = ['text', 'number', 'date', 'boolean']

const TYPE_LABELS: Record<EditableColumn['type'], string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
  boolean: 'Booleano',
}

let nextKey = 0

function newColumn(): EditableColumn {
  nextKey += 1
  return { key: `nueva-${nextKey}`, id: null, name: '', type: 'text' }
}

export function TableForm({ tableId, name, description, status, columns: initial }: TableFormProps) {
  const [state, formAction, isPending] = useActionState(saveTable, INITIAL_STATE)
  const [columns, setColumns] = useState<EditableColumn[]>(initial)

  // Ids que existian al abrir el formulario: si alguno desaparece, guardar
  // borra datos de todas las filas y hay que confirmarlo (S5 + DATA-6.1).
  const initialIds = useRef(
    initial.map((column) => column.id).filter((id): id is string => id !== null)
  ).current

  function update(index: number, patch: Partial<EditableColumn>) {
    setColumns((current) =>
      current.map((column, position) => (position === index ? { ...column, ...patch } : column))
    )
  }

  function remove(index: number) {
    setColumns((current) => current.filter((_, position) => position !== index))
  }

  function move(index: number, delta: number) {
    setColumns((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const copy = [...current]
      const [moved] = copy.splice(index, 1)
      copy.splice(target, 0, moved)
      return copy
    })
  }

  function confirmDestructiveChange(): boolean {
    const removed = initialIds.filter(
      (id) => !columns.some((column) => column.id === id)
    )

    if (removed.length === 0) return true

    return window.confirm(
      `Vas a eliminar ${removed.length} columna(s). Se borran sus datos en TODAS las filas de la tabla y no se puede deshacer. ¿Continuar?`
    )
  }

  const payload = columns.map(({ id, name: columnName, type }) => ({
    id,
    name: columnName,
    type,
  }))

  return (
    <form
      action={formAction}
      autoComplete="off"
      onSubmit={(event) => {
        if (!confirmDestructiveChange()) {
          event.preventDefault()
        }
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="tableId" value={tableId ?? ''} />
      <input type="hidden" name="columns" value={JSON.stringify(payload)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            name="name"
            defaultValue={name}
            required
            maxLength={80}
            disabled={isPending}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="hidden">Oculta</option>
            <option value="published">Publicada</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          name="description"
          defaultValue={description}
          maxLength={200}
          disabled={isPending}
          autoComplete="off"
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Columnas</legend>

        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            La tabla necesita al menos una columna.
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {columns.map((column, index) => (
            <li key={column.key} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="flex min-w-40 flex-1 flex-col gap-1">
                <Label htmlFor={`column-${column.key}`}>Nombre</Label>
                <Input
                  id={`column-${column.key}`}
                  value={column.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  disabled={isPending}
                  maxLength={60}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor={`type-${column.key}`}>Tipo</Label>
                <select
                  id={`type-${column.key}`}
                  value={column.type}
                  onChange={(event) =>
                    update(index, { type: event.target.value as EditableColumn['type'] })
                  }
                  disabled={isPending}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {COLUMN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => move(index, -1)}
                  disabled={isPending || index === 0}
                  aria-label={`Subir ${column.name || 'columna'}`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => move(index, 1)}
                  disabled={isPending || index === columns.length - 1}
                  aria-label={`Bajar ${column.name || 'columna'}`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remove(index)}
                  disabled={isPending}
                  aria-label={`Quitar ${column.name || 'columna'}`}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setColumns((current) => [...current, newColumn()])}
            disabled={isPending}
          >
            Agregar columna
          </Button>
        </div>
      </fieldset>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : tableId ? 'Guardar cambios' : 'Crear tabla'}
        </Button>
      </div>
    </form>
  )
}
