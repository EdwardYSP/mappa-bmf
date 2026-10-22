import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/features/auth/components/login-form'
import { getAdminSession } from '@/features/auth/session'

export const metadata: Metadata = {
  title: 'Acceso de administrador',
}

export default async function LoginPage() {
  // S1: quien ya es admin no tiene nada que hacer en /login.
  const session = await getAdminSession()
  if (session.status === 'admin') {
    redirect('/admin/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <LoginForm />
    </main>
  )
}
