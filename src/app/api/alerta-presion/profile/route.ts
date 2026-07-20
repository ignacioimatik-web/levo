import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/alerta-presion/profile — devuelve TODOS los perfiles del usuario
 * POST /api/alerta-presion/profile — crea un NUEVO perfil
 * PATCH /api/alerta-presion/profile — actualiza un perfil existente (requiere ?id=xxx)
 * DELETE /api/alerta-presion/profile?id=xxx — elimina un perfil
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabase
    .from('bike_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const {
    profile_name, rider_weight_kg, bike_weight_kg, bike_model,
    wheel_front, wheel_rear, tire_model_front, tire_model_rear,
    tire_width_front_inch, tire_width_rear_inch,
    initial_pressure_front_bar, initial_pressure_rear_bar, tubeless,
  } = body;

  if (!rider_weight_kg) {
    return NextResponse.json({ error: 'Falta peso del ciclista' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bike_profiles')
    .insert({
      user_id: user.id,
      profile_name: profile_name || `Perfil ${new Date().toLocaleDateString()}`,
      rider_weight_kg,
      bike_weight_kg: bike_weight_kg || 20,
      bike_model: bike_model || '',
      wheel_front: wheel_front || '27.5',
      wheel_rear: wheel_rear || '27.5',
      tire_model_front: tire_model_front || '',
      tire_model_rear: tire_model_rear || '',
      tire_width_front_inch: tire_width_front_inch || 2.3,
      tire_width_rear_inch: tire_width_rear_inch || 2.3,
      initial_pressure_front_bar: initial_pressure_front_bar || 1.8,
      initial_pressure_rear_bar: initial_pressure_rear_bar || 2.0,
      tubeless: tubeless ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const body = await request.json();
  const {
    profile_name, rider_weight_kg, bike_weight_kg, bike_model,
    wheel_front, wheel_rear, tire_model_front, tire_model_rear,
    tire_width_front_inch, tire_width_rear_inch,
    initial_pressure_front_bar, initial_pressure_rear_bar, tubeless,
  } = body;

  const payload: any = { updated_at: new Date().toISOString() };
  if (profile_name !== undefined) payload.profile_name = profile_name;
  if (rider_weight_kg !== undefined) payload.rider_weight_kg = rider_weight_kg;
  if (bike_weight_kg !== undefined) payload.bike_weight_kg = bike_weight_kg;
  if (bike_model !== undefined) payload.bike_model = bike_model;
  if (wheel_front !== undefined) payload.wheel_front = wheel_front;
  if (wheel_rear !== undefined) payload.wheel_rear = wheel_rear;
  if (tire_model_front !== undefined) payload.tire_model_front = tire_model_front;
  if (tire_model_rear !== undefined) payload.tire_model_rear = tire_model_rear;
  if (tire_width_front_inch !== undefined) payload.tire_width_front_inch = tire_width_front_inch;
  if (tire_width_rear_inch !== undefined) payload.tire_width_rear_inch = tire_width_rear_inch;
  if (initial_pressure_front_bar !== undefined) payload.initial_pressure_front_bar = initial_pressure_front_bar;
  if (initial_pressure_rear_bar !== undefined) payload.initial_pressure_rear_bar = initial_pressure_rear_bar;
  if (tubeless !== undefined) payload.tubeless = tubeless;

  const { data, error } = await supabase
    .from('bike_profiles')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabase
    .from('bike_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
