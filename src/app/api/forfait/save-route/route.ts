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
    .select('id, name, track_ids, distance_km, elevation_gain_m, elevation_loss_m, estimated_time_min, difficulty, created_at, updated_at')
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
  const { name, track_ids, distance_km, elevation_gain_m, elevation_loss_m, estimated_time_min, difficulty } = body;

  if (!Array.isArray(track_ids) || track_ids.length === 0) {
    return NextResponse.json({ error: 'track_ids debe ser un array no vacío' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_routes')
    .insert({
      user_id: user.id,
      name: name || 'Mi ruta',
      track_ids,
      distance_km: distance_km ?? 0,
      elevation_gain_m: elevation_gain_m ?? 0,
      elevation_loss_m: elevation_loss_m ?? 0,
      estimated_time_min: estimated_time_min ?? 0,
      difficulty: difficulty ?? 'verde',
    })
    .select('id, name, track_ids, distance_km, elevation_gain_m, elevation_loss_m, estimated_time_min, difficulty, created_at, updated_at')
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
