'use client'

import { errorDigest } from '@/components/status-page'

/**
 * Ultimo recurso: reemplaza el layout raiz cuando algo falla ahí (por ejemplo
 * al importar los estilos globales). Por eso define su propio <html> y <body> y
 * NO puede usar Tailwind: globals.css no llega hasta acá. Todo va en linea.
 * Tampoco admite `metadata`: el titulo se pone con <title>.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const digest = errorDigest(error)

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#171717',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <main
          style={{
            maxWidth: '30rem',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            textAlign: 'center',
          }}
        >
          <title>Error del sitio</title>
          <p aria-hidden="true" style={{ margin: 0, fontSize: '3.5rem', fontWeight: 600, color: '#d4d4d4' }}>
            500
          </p>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>
            El sitio no pudo arrancar
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#525252' }}>
            Falló algo en la base de la aplicación, no en lo que estabas viendo. Probá recargar.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: '0.5rem',
              padding: '0.45rem 0.9rem',
              fontSize: '0.9rem',
              borderRadius: '0.375rem',
              border: '1px solid #171717',
              background: '#171717',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
          {digest ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#737373', fontFamily: 'ui-monospace, monospace' }}>
              Código: {digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
