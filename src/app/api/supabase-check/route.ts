import { NextResponse } from 'next/server'

type Check = {
  name: 'auth' | 'data'
  ok: boolean
  detail: string
}

type CheckResponse = {
  connected: boolean
  checks: Check[]
  message: string
}

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

/**
 * PostgREST devuelve este codigo cuando la peticion se autentico bien pero la
 * tabla todavia no existe: la clave es valida y el esquema esta sin migrar.
 */
function isTableMissing(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { code?: unknown }).code === 'PGRST205'
  )
}

async function request(url: string, key?: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: key
        ? { apikey: key, Accept: 'application/json' }
        : { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    return null
  }
}

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!rawUrl || !key) {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name])
    return NextResponse.json<CheckResponse>(
      {
        connected: false,
        checks: [],
        message: `Faltan variables de entorno: ${missing.join(', ')}`,
      },
      { status: 500 }
    )
  }

  const baseUrl = rawUrl.replace(/\/+$/, '')
  const checks: Check[] = []

  // Auth (GoTrue) tambien exige el header apikey: sin el responde 401.
  const auth = await request(`${baseUrl}/auth/v1/health`, key)
  checks.push({
    name: 'auth',
    ok: auth?.ok ?? false,
    detail: auth ? `HTTP ${auth.status}` : 'sin respuesta',
  })

  // El endpoint raiz /rest/v1/ exige una secret key, asi que la clave
  // publishable se valida consultando una tabla del esquema publico.
  const data = await request(`${baseUrl}/rest/v1/tables?select=id&limit=1`, key)
  const payload: unknown = data ? await data.json().catch(() => null) : null
  const tableMissing = isTableMissing(payload)
  checks.push({
    name: 'data',
    ok: (data?.ok ?? false) || tableMissing,
    detail: tableMissing
      ? 'clave valida, esquema sin migraciones todavia'
      : data
        ? `HTTP ${data.status}`
        : 'sin respuesta',
  })

  const connected = checks.every((check) => check.ok)
  return NextResponse.json<CheckResponse>(
    {
      connected,
      checks,
      message: connected
        ? 'Supabase responde y la clave publishable es valida'
        : 'Supabase no respondio correctamente',
    },
    { status: connected ? 200 : 502 }
  )
}
