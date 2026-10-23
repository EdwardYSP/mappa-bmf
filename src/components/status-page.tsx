import type { ReactNode } from 'react'

/**
 * Next adjunta un digest opaco a los errores del servidor: sirve para
 * correlacionar con los logs sin filtrar detalles internos al visitante.
 */
export function errorDigest(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
    const digest = (error as { digest?: unknown }).digest
    return typeof digest === 'string' ? digest : null
  }
  return null
}

type StatusPageProps = {
  code: string
  title: string
  description: string
  children?: ReactNode
}

/**
 * Pantalla de estado compartida por los errores 404 y 5xx.
 * Es una pagina, no un mensaje suelto: codigo grande, titulo, explicacion y
 * acciones de salida. Los colores salen de los tokens del tema.
 */
export function StatusPage({ code, title, description, children }: StatusPageProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <p
        aria-hidden="true"
        className="text-6xl font-semibold tracking-tight text-muted-foreground/30"
      >
        {code}
      </p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>
      ) : null}
    </main>
  )
}
