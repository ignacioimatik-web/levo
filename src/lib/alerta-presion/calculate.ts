/**
 * Alerta Presión — MTB tire pressure calculation
 *
 * Calculates recommended tire pressures for technical descents
 * based on rider+bike weight, tire width (inches), temperature, and humidity.
 *
 * Objective: maximum grip without pinch flats or burping.
 * - Technical descents → lower pressure for grip
 * - Temperature compensation (~0.07 PSI/°C)
 * - Humidity affects tackiness
 * - Tubeless can run 2-3 PSI lower
 */
import type { BikeProfile, CalculationInput, PressureRecommendation } from './types';

const PSI_PER_BAR = 14.504;
const REF_TEMP_C = 20;

function barToPsi(bar: number): number {
  return Math.round(bar * PSI_PER_BAR * 10) / 10;
}
function psiToBar(psi: number): number {
  return Math.round((psi / PSI_PER_BAR) * 100) / 100;
}

export function calculatePressure(input: CalculationInput): PressureRecommendation {
  const { profile, temperatureC, humidityPct, descent } = input;
  const totalWeightKg = profile.riderWeightKg + profile.bikeWeightKg;

  // Tire width in inches (directly from profile)
  const frontWidthIn = profile.tireWidthFrontInch;
  const rearWidthIn = profile.tireWidthRearInch;

  // --- Base pressure (PSI) ---
  // Formula: (total_weight_lbs * factor) / (tire_width_in * volume_coefficient)
  // Lower factor = lower pressure = more grip
  // Volume coefficient: 27.5" ≈ 0.85, 29" ≈ 0.95 (more volume = less pressure)
  const volFront = frontWidthIn * (profile.wheelFront === '29' ? 0.95 : 0.85);
  const volRear = rearWidthIn * (profile.wheelRear === '29' ? 0.95 : 0.85);
  const weightLbs = totalWeightKg * 2.205;

  // Front: ~40% weight, needs grip → lower factor = lower pressure
  // Rear: ~60% weight, needs support → higher factor = higher pressure
  let frontPsi = (weightLbs * 0.080) / Math.max(volFront, 1.5);
  let rearPsi = (weightLbs * 0.092) / Math.max(volRear, 1.5);

  // --- Tubeless bonus (can run lower) ---
  if (profile.tubeless) { frontPsi -= 2.5; rearPsi -= 2.0; }

  // --- Technical descent: maximise grip, lower pressure ---
  // Descents need more grip up front, moderate reduction rear
  frontPsi -= 2.5;
  rearPsi -= 1.2;

  // --- Temperature compensation ---
  const tempDiff = temperatureC - REF_TEMP_C;
  frontPsi += tempDiff * 0.07;
  rearPsi += tempDiff * 0.07;

  // --- Humidity / trail condition ---
  if (humidityPct >= 70) {
    // Wet/tacky → can run slightly lower for extra grip
    frontPsi -= 0.5; rearPsi -= 0.3;
  } else if (humidityPct <= 35) {
    // Dry/dusty → slightly higher to avoid burping on loose terrain
    frontPsi += 0.5; rearPsi += 0.3;
  }

  // --- Safety minimums ---
  const minPsi = profile.tubeless ? 15 : 19;
  const maxPsi = 38;
  frontPsi = Math.max(minPsi, Math.min(maxPsi, frontPsi));
  rearPsi = Math.max(minPsi + 1, Math.min(maxPsi, rearPsi));

  // Round to 0.5 PSI
  frontPsi = Math.round(frontPsi * 2) / 2;
  rearPsi = Math.round(rearPsi * 2) / 2;

  const currentFrontPsi = profile.initialPressureFrontBar * PSI_PER_BAR;
  const currentRearPsi = profile.initialPressureRearBar * PSI_PER_BAR;

  // Build reason
  const parts: string[] = [];
  parts.push(`${totalWeightKg}kg totales`);
  if (profile.tubeless) parts.push('tubeless');
  parts.push(`${frontWidthIn.toFixed(1)}\" del. / ${rearWidthIn.toFixed(1)}\" tras.`);
  if (tempDiff > 0) parts.push(`+${tempDiff.toFixed(0)}°C → sube presión`);
  else if (tempDiff < 0) parts.push(`${tempDiff.toFixed(0)}°C → baja presión`);
  if (humidityPct >= 70) parts.push('suelo húmedo → más agarre');
  else if (humidityPct <= 35) parts.push('suelo seco → +seguridad');
  parts.push('descenso técnico → máximo agarre');

  return {
    currentFrontBar: profile.initialPressureFrontBar,
    currentRearBar: profile.initialPressureRearBar,
    recommendedFrontBar: psiToBar(frontPsi),
    recommendedRearBar: psiToBar(rearPsi),
    currentFrontPsi: Math.round(currentFrontPsi * 10) / 10,
    currentRearPsi: Math.round(currentRearPsi * 10) / 10,
    recommendedFrontPsi: frontPsi,
    recommendedRearPsi: rearPsi,
    temperatureC,
    humidityPct,
    terrainType: 'enduro',
    reason: parts.join(' · '),
  };
}
