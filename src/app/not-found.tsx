import Link from 'next/link'

/** S2: la tabla no existe o esta oculta. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">No encontramos esa tabla</h1>
      <p className="text-sm text-muted-foreground">
        Puede que no exista o que no esté publicada.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Volver al inicio
      </Link>
    </main>
  )
}
