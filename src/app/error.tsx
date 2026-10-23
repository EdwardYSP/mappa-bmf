'use client'

import Link from 'next/link'
import { errorDigest, StatusPage } from '@/components/status-page'

/**
 * S5: error de cualquier pagina. El prop se llama `retry` en Next 16
 * (antes `reset`): llamar al nombre viejo rompia el boton, porque quedaba
 * undefined. `error` llega como desconocido: hay que angostarlo antes de leerlo.
 */
export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const digest = errorDigest(error)

  return (
    <StatusPage
      code="500"
      title="Algo se rompió de nuestro lado"
      description="No pudimos cargar la información. Probá de nuevo; si el problema sigue, pasale el código de abajo a quien mantiene el sitio."
    >
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
      >
        Reintentar
      </button>
      <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
        Volver al inicio
      </Link>
      {digest ? (
        <p className="w-full pt-2 font-mono text-xs text-muted-foreground">Código: {digest}</p>
      ) : null}
    </StatusPage>
  )
}
