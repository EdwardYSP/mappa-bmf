import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * S2: ruta de retorno de Supabase Auth. Intercambia el codigo por una sesion
 * (canjea el token y escribe las cookies) y manda al panel.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Solo rutas internas: "//otro-sitio" seria un redirect abierto.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/admin/dashboard'
  return NextResponse.redirect(`${origin}${target}`)
}
