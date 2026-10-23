import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/update-session'

// Next 16 renombro la convencion "middleware" a "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Todo menos los recursos estaticos: la sesion se refresca tambien en las
  // paginas publicas, para que el token no llegue vencido al panel.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
