import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, track_ids, distance_km, elevation_gain_m, elevation_loss_m, estimated_time_min, difficulty, route_points, warnings, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const {
    id, name, track_ids, distance_km, elevation_gain_m, elevation_loss_m,
    estimated_time_min, difficulty, route_points, warnings,
  } = body;
  const validId = typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  const validTrackIds = Array.isArray(track_ids)
    && track_ids.length <= 200
    && track_ids.every((id) => typeof id === 'string' && id.length <= 120);
  const validRoutePoints = Array.isArray(route_points)
    && route_points.length >= 2
    && route_points.length <= 20_000
    && route_points.every((point) => (
      point
      && Number.isFinite(Number(point.latitude))
      && Number.isFinite(Number(point.longitude))
      && Number(point.latitude) >= -90
      && Number(point.latitude) <= 90
      && Number(point.longitude) >= -180
      && Number(point.longitude) <= 180
    ));
  if (!validTrackIds || (!track_ids.length && !validRoutePoints)) {
    return NextResponse.json({ error: 'La ruta necesita tracks conocidos o un trazado válido.' }, { status: 400 });
  }

  const routeRecord = {
    ...(validId ? { id } : {}),
    user_id: user.id,
    name: name || 'Mi ruta',
    track_ids,
    distance_km: distance_km ?? 0,
    elevation_gain_m: elevation_gain_m ?? 0,
    elevation_loss_m: elevation_loss_m ?? 0,
    estimated_time_min: estimated_time_min ?? 0,
    difficulty: difficulty ?? 'verde',
    route_points: validRoutePoints ? route_points : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    updated_at: new Date().toISOString(),
  };
  const query = validId
    ? supabase.from('saved_routes').upsert(routeRecord, { onConflict: 'id' })
    : supabase.from('saved_routes').insert(routeRecord);
  const { data, error } = await query
    .select('id, name, track_ids, distance_km, elevation_gain_m, elevation_loss_m, estimated_time_min, difficulty, route_points, warnings, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ route: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Falta el parámetro id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
