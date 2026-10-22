import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'
import { getAdminSession } from '@/features/auth/session'

export default async function AdminDashboardPage() {
  const session = await getAdminSession()

  // El layout ya lo garantiza; esto es para que el tipo lo sepa.
  if (session.status !== 'admin') {
    redirect('/login')
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">{session.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </header>

      <p className="text-sm text-muted-foreground">
        La gestión de tablas y registros llega en la Fase 6.
      </p>
    </main>
  )
}
