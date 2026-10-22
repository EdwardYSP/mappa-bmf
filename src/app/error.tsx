'use client'

/** S5: mensaje amable, sin detalles tecnicos del error. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No pudimos cargar la información. Probá de nuevo en unos segundos.
      </p>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        Reintentar
      </button>
    </main>
  )
}
