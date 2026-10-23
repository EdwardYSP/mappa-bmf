import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

const PROTECTED_PREFIX = '/admin'
const LOGIN_PATH = '/login'

/**
 * S3: el proxy SOLO refresca la sesion y corta el paso a /admin cuando no hay
 * sesion. El rol se verifica en el layout del servidor (src/app/admin).
 * Verificar el rol aca agregaria una consulta a la base en cada request.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() valida el token contra Auth y, de paso, lo renueva cuando hace
  // falta. getSession() no sirve aca: confia en la cookie sin verificarla.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
