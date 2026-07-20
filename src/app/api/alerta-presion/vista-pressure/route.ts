import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAemetNowForLocation } from '@/lib/aemet';
import { calculatePressure } from '@/lib/alerta-presion/calculate';
import type { BikeProfile, DescentInfo } from '@/lib/alerta-presion/types';

/**
 * GET /api/alerta-presion/vista-pressure?lat=...&lng=...&trackName=...
 * Returns weather + recommended pressure for the user's default profile.
 * Used in VistaForfait tooltip.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const trackName = searchParams.get('trackName') || 'Ruta';

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  // Fetch weather
  const weather = await getAemetNowForLocation(lat, lng);
  const temperatureC = weather?.weightedRouteTempC ?? weather?.temperatureC ?? 20;
  const humidityPct = weather?.humidityPct ?? 50;

  // Try to load user's default profile
  let defaultProfile: BikeProfile | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('bike_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (data) {
        defaultProfile = {
          riderWeightKg: data.rider_weight_kg,
          bikeWeightKg: data.bike_weight_kg,
          bikeModel: data.bike_model || '',
          wheelFront: data.wheel_front || '27.5',
          wheelRear: data.wheel_rear || '27.5',
          tireModelFront: data.tire_model_front || '',
          tireModelRear: data.tire_model_rear || '',
          tireWidthFrontInch: data.tire_width_front_inch || 2.3,
          tireWidthRearInch: data.tire_width_rear_inch || 2.3,
          initialPressureFrontBar: data.initial_pressure_front_bar || 1.8,
          initialPressureRearBar: data.initial_pressure_rear_bar || 2.0,
          tubeless: data.tubeless ?? true,
        };
      }
    }
  } catch {}

  // If no saved profile, use defaults
  if (!defaultProfile) {
    defaultProfile = {
      riderWeightKg: 75,
      bikeWeightKg: 20,
      bikeModel: '',
      wheelFront: '27.5',
      wheelRear: '27.5',
      tireModelFront: '',
      tireModelRear: '',
      tireWidthFrontInch: 2.3,
      tireWidthRearInch: 2.3,
      initialPressureFrontBar: 1.8,
      initialPressureRearBar: 2.0,
      tubeless: true,
    };
  }

  // Calculate pressure for this track (use a single descent at the midpoint)
  const descent: DescentInfo = {
    id: trackName,
    name: trackName,
    trackName,
    distanceKm: 0,
    elevationLoss: 0,
    elevationGain: 0,
    midpoint: { lat, lng },
  };

  const recommendation = calculatePressure({
    profile: defaultProfile,
    temperatureC,
    humidityPct,
    descent,
  });

  return NextResponse.json({
    temperatureC,
    humidityPct,
    windKmh: weather?.windKmh ?? null,
    stationName: weather?.stationName ?? null,
    recommendedFrontBar: recommendation.recommendedFrontBar,
    recommendedRearBar: recommendation.recommendedRearBar,
    recommendedFrontPsi: recommendation.recommendedFrontPsi,
    recommendedRearPsi: recommendation.recommendedRearPsi,
    initialFrontBar: recommendation.currentFrontBar,
    initialRearBar: recommendation.currentRearBar,
  });
}
