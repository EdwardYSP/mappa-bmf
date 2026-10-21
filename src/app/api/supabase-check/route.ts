
import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    return NextResponse.json(
      { connected: false, message: 'Faltan variables de entorno' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/openapi+json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,
          message: 'Supabase respondió con un error',
          status: response.status,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      connected: true,
      message: 'La API de Supabase responde correctamente',
    })
  } catch {
    return NextResponse.json(
      { connected: false, message: 'No se pudo contactar con Supabase' },
      { status: 502 }
    )
  }
}
