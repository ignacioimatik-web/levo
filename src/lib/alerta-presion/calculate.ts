/**
 * Alerta Presión — MTB tire pressure calculation
 *
 * Calculates recommended tire pressures for technical descents.
 *
 * Base reference:
 *   95 kg total (80 rider + 15 bike) on 2.3" tubeless → 22 PSI front / 25 PSI rear
 * Scales by actual weight and tire width.
 *
 * Adjustments:
 *   - Tubeless: -2.5 PSI front, -2.0 PSI rear
 *   - Technical descent: -2.0 PSI front (grip), -1.0 PSI rear
 *   - Temperature: ±0.07 PSI per °C from 20°C
 *   - Humidity: high ≥70% → -0.5 PSI (more grip), low ≤35% → +0.5 PSI (loose terrain)
 */
import type { BikeProfile, CalculationInput, PressureRecommendation } from './types';

const PSI_PER_BAR = 14.504;
const REF_TEMP_C = 20;
const REF_WEIGHT_KG = 95;
const REF_WIDTH_IN = 2.3;
const REF_FRONT_PSI = 22;
const REF_REAR_PSI = 25;

function barToPsi(bar: number): number {
  return Math.round(bar * PSI_PER_BAR * 10) / 10;
}
function psiToBar(psi: number): number {
  return Math.round((psi / PSI_PER_BAR) * 100) / 100;
}

export function calculatePressure(input: CalculationInput): PressureRecommendation {
  const { profile, temperatureC, humidityPct } = input;
  const totalKg = profile.riderWeightKg + profile.bikeWeightKg;

  // Scale from reference weight and tire width
  const frontScale = (totalKg / REF_WEIGHT_KG) * (REF_WIDTH_IN / profile.tireWidthFrontInch);
  const rearScale  = (totalKg / REF_WEIGHT_KG) * (REF_WIDTH_IN / profile.tireWidthRearInch);

  let frontPsi = REF_FRONT_PSI * frontScale;
  let rearPsi  = REF_REAR_PSI  * rearScale;

  // --- Tubeless ---
  if (profile.tubeless) { frontPsi -= 2.5; rearPsi -= 2.0; }

  // --- Technical descent (max grip, avoid pinch flats) ---
  frontPsi -= 2.0;
  rearPsi  -= 1.0;

  // --- Temperature (ideal gas law: ~0.07 PSI/°C) ---
  const tempDiff = temperatureC - REF_TEMP_C;
  frontPsi += tempDiff * 0.07;
  rearPsi  += tempDiff * 0.07;

  // --- Humidity / trail condition ---
  if (humidityPct >= 70) {
    frontPsi -= 0.5; rearPsi -= 0.3;
  } else if (humidityPct <= 35) {
    frontPsi += 0.5; rearPsi += 0.3;
  }

  // --- Safety minimums (tubeless vs tubes) ---
  const minFront = profile.tubeless ? 16 : 20;
  const minRear  = profile.tubeless ? 18 : 22;
  const maxPsi = 40;
  frontPsi = Math.max(minFront, Math.min(maxPsi, frontPsi));
  rearPsi  = Math.max(minRear,  Math.min(maxPsi, rearPsi));

  // Round to 0.5 PSI
  frontPsi = Math.round(frontPsi * 2) / 2;
  rearPsi  = Math.round(rearPsi * 2) / 2;

  const currentFrontPsi = profile.initialPressureFrontBar * PSI_PER_BAR;
  const currentRearPsi  = profile.initialPressureRearBar * PSI_PER_BAR;

  // Reason string
  const parts: string[] = [
    `${totalKg}kg totales`,
    profile.tubeless ? 'tubeless' : 'cámara',
    `${profile.tireWidthFrontInch.toFixed(1)}" del. / ${profile.tireWidthRearInch.toFixed(1)}" tras.`,
  ];
  const absDiff = Math.abs(tempDiff);
  if (absDiff >= 3) {
    parts.push(tempDiff > 0 ? `${tempDiff.toFixed(0)}°C → +presión` : `${tempDiff.toFixed(0)}°C → -presión`);
  }
  if (humidityPct >= 70) parts.push('suelo húmedo → -presión (agarre)');
  else if (humidityPct <= 35) parts.push('suelo seco → +presión (seguridad)');
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
