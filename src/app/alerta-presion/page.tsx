import { createClient } from '@/lib/supabase/server';
import PressureAlertClient from '@/components/pressure/PressureAlertClient';

export const metadata = {
  title: 'Alerta presión | E-nduro Ebiketracks',
  description: 'Configura tu bici y calcula la presión recomendada para descensos técnicos.',
};

export default async function PressureAlertPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('bike_name,rider_weight_kg,bike_weight_kg,wheel_size,front_tire_model,rear_tire_model,front_tire_pressure_bar,rear_tire_pressure_bar').eq('user_id', user.id).maybeSingle()
    : { data: null };
  return <PressureAlertClient initialProfile={{
    userId: user?.id ?? null,
    riderWeightKg: profile?.rider_weight_kg ?? null,
    bikeWeightKg: profile?.bike_weight_kg ?? null,
    bikeName: profile?.bike_name ?? '',
    wheelSize: profile?.wheel_size ?? '29',
    frontTireModel: profile?.front_tire_model ?? '',
    rearTireModel: profile?.rear_tire_model ?? '',
    frontTirePressureBar: profile?.front_tire_pressure_bar ?? null,
    rearTirePressureBar: profile?.rear_tire_pressure_bar ?? null,
  }} />;
}
