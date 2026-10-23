import { createClient } from '@/lib/supabase/server'

export type AdminSession =
  | { status: 'admin'; email: string }
  | { status: 'member'; email: string }
  | { status: 'anonymous' }

/**
 * S3: la verificacion del rol es responsabilidad del servidor.
 *
 * Se apoya en public.is_admin(), la misma funcion que evaluan las politicas
 * RLS. Una comprobacion local del JWT podria quedar desacuerdo con la base
 * (claim viejo, hook apagado, rol recien cambiado); esta no.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'anonymous' }
  }

  const email = user.email ?? ''
  const { data: isAdmin, error } = await supabase.rpc('is_admin')

  if (error) {
    // Falla cerrado: si no se puede confirmar el rol, no es admin.
    console.error('[auth] no se pudo verificar el rol:', error.message)
    return { status: 'member', email }
  }

  return isAdmin === true ? { status: 'admin', email } : { status: 'member', email }
}
