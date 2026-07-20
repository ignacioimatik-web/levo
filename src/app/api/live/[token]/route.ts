import { NextResponse } from 'next/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: 'Seguimiento no disponible' }, { status: 503 });
  }

  const query = new URLSearchParams({
    select: 'title,status,started_at,ended_at,latitude,longitude,elevation_m,distance_m,battery_percent,updated_at',
    share_token: `eq.${token}`,
    limit: '1',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/live_sessions?${query}`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'x-share-token': token,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'No se pudo consultar el seguimiento' }, { status: 502 });
  }
  const rows = await response.json() as unknown[];
  if (!rows.length) {
    return NextResponse.json({ error: 'Seguimiento no encontrado' }, { status: 404 });
  }

  return NextResponse.json(rows[0], {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
