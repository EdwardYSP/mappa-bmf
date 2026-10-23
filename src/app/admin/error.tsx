'use client'

import Link from 'next/link'
import { errorDigest, StatusPage } from '@/components/status-page'

/**
 * Error de la zona de administracion. Vive DENTRO de /admin, asi que conserva
 * la cabecera del panel: el admin no pierde el contexto ni la sesion.
 */
export default function AdminError({
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
      title="No pudimos cargar el panel"
      description="La operación no se completó. Podés reintentar; si falla de nuevo, volvé a las tablas y revisá los datos."
    >
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
      >
        Reintentar
      </button>
      <Link
        href="/admin/dashboard"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Ir a las tablas
      </Link>
      {digest ? (
        <p className="w-full pt-2 font-mono text-xs text-muted-foreground">Código: {digest}</p>
      ) : null}
    </StatusPage>
  )
}
