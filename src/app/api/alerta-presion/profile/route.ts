import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/alerta-presion/profile
 * Returns the user's bike profile (if logged in).
 * POST /api/alerta-presion/profile
 * Creates or updates the user's bike profile.
 * DELETE /api/alerta-presion/profile?id=xxx
 * Deletes a bike profile.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('bike_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const {
    rider_weight_kg, bike_weight_kg, bike_model,
    wheel_type, tire_model_front, tire_model_rear,
    tire_width_front_mm, tire_width_rear_mm,
    initial_pressure_front_bar, initial_pressure_rear_bar,
    tubeless,
  } = body;

  // Validation
  if (!rider_weight_kg || !bike_weight_kg) {
    return NextResponse.json({ error: 'Faltan datos obligatorios (peso, bici)' }, { status: 400 });
  }

  // Upsert: check if user already has a profile
  const { data: existing } = await supabase
    .from('bike_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    rider_weight_kg,
    bike_weight_kg,
    bike_model: bike_model || '',
    wheel_type: wheel_type || '29',
    tire_model_front: tire_model_front || '',
    tire_model_rear: tire_model_rear || '',
    tire_width_front_mm: tire_width_front_mm || 60,
    tire_width_rear_mm: tire_width_rear_mm || 60,
    initial_pressure_front_bar: initial_pressure_front_bar || 1.8,
    initial_pressure_rear_bar: initial_pressure_rear_bar || 2.0,
    tubeless: tubeless ?? true,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing?.id) {
    result = await supabase
      .from('bike_profiles')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('bike_profiles')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
  }

  const { data, error } = result;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data }, { status: existing?.id ? 200 : 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('bike_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
