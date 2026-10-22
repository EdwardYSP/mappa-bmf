import { redirect } from 'next/navigation'
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

  return <div className="min-h-screen bg-background">{children}</div>
}
