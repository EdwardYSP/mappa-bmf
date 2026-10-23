import Link from 'next/link'
import { StatusPage } from '@/components/status-page'

/**
 * S2: se muestra para una tabla que no existe o que esta oculta, y para
 * cualquier ruta que no exista. Next responde 404 real cuando la pagina se
 * resuelve antes de empezar a transmitir (por eso no hay loading.tsx arriba).
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="No encontramos esa página"
      description="Puede que la tabla no exista, que no esté publicada o que la dirección esté mal escrita."
    >
      <Link
        href="/"
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
      >
        Ver las tablas públicas
      </Link>
      <Link href="/login" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
        Soy administrador
      </Link>
    </StatusPage>
  )
}
