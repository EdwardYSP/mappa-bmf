'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error: string | null }

/** S1 + S2: inicio de sesion del administrador. */
export async function signIn(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Correo y contraseña son obligatorios.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // S4: nunca se muestra el error crudo de Supabase.
    return { error: 'Correo o contraseña incorrectos.' }
  }

  // S1: solo el rol admin entra al panel. Se consulta con el mismo cliente que
  // acaba de iniciar sesion, asi que la verificacion usa el token nuevo.
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')

  if (roleError) {
    console.error('[auth] no se pudo verificar el rol:', roleError.message)
    return { error: 'No se pudo verificar el rol. Intenta de nuevo.' }
  }

  if (isAdmin !== true) {
    return { error: 'Esta cuenta no tiene permisos de administrador.' }
  }

  revalidatePath('/', 'layout')
  redirect('/admin/dashboard')
}

/** S2: cierre de sesion, limpia las cookies y vuelve al panel publico. */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/')
}
