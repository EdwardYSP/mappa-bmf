import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions'
import { getAdminSession } from '@/features/auth/session'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()

  // S3 + S5: sin sesion va al login; con sesion pero sin rol admin, fuera de /admin.
  if (session.status === 'anonymous') {
    redirect('/login')
  }

  if (session.status === 'member') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 p-4">
          <nav className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="font-medium">
              Administración
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              Panel público
            </Link>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{session.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
