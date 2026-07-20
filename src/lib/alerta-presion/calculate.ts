/**
 * Alerta Presión — MTB tire pressure calculation
 *
 * Calculates recommended tire pressures for technical descents
 * based on rider+bike weight, tire width, temperature, and humidity.
 *
 * Formula basis:
 * - Base pressure proportional to total weight / tire contact patch
 * - Temperature compensation: ~0.07 PSI per °C deviation from 20°C
 * - Technical terrain: slightly lower for grip (with safety minimums)
 * - High humidity → more grip available → can run slightly lower
 */
import type { BikeProfile, CalculationInput, PressureRecommendation } from './types';

const PSI_PER_BAR = 14.504;
const REF_TEMP_C = 20;

/** Convert bar ↔ PSI */
export function barToPsi(bar: number): number {
  return Math.round(bar * PSI_PER_BAR * 10) / 10;
}
export function psiToBar(psi: number): number {
  return Math.round((psi / PSI_PER_BAR) * 100) / 100;
}

/**
 * Calculate recommended tire pressure for technical descents.
 */
export function calculatePressure(input: CalculationInput): PressureRecommendation {
  const { profile, temperatureC, humidityPct, difficulty } = input;
  const totalWeightKg = profile.riderWeightKg + profile.bikeWeightKg;

  // Tire width in inches for the formula
  const frontWidthIn = profile.tireWidthFrontMm / 25.4;
  const rearWidthIn = profile.tireWidthRearMm / 25.4;

  // --- Base pressure (PSI) ---
  // Core formula: (total_weight_lbs * factor) / (tire_width_in * volume_coefficient)
  // where volume_coefficient accounts for tire casing volume (~0.9 for MTB)
  const weightLbs = totalWeightKg * 2.205;
  const volFront = frontWidthIn * 0.9;
  const volRear = rearWidthIn * 0.9;

  // Front carries ~40% of weight, rear ~60% in aggressive descending
  // But we also want more grip up front, so front pressure is relatively lower
  let frontPsi = (weightLbs * 0.085) / Math.max(volFront, 1.5);
  let rearPsi = (weightLbs * 0.095) / Math.max(volRear, 1.5);

  // --- Tire type adjustment ---
  // Tubeless can run 2-3 PSI lower
  if (profile.tubeless) {
    frontPsi -= 2.5;
    rearPsi -= 2.0;
  }

  // --- Terrain / difficulty adjustment ---
  // Technical descents need lower pressure for grip, but not too low (pinch flats)
  const terrainType = difficulty === 'doble-negro' ? 'dh'
    : difficulty === 'negro' ? 'enduro'
    : 'trail';

  switch (terrainType) {
    case 'dh':
      frontPsi -= 3.0;
      rearPsi -= 1.5;
      break;
    case 'enduro':
      frontPsi -= 2.0;
      rearPsi -= 1.0;
      break;
    case 'trail':
      frontPsi -= 0.5;
      rearPsi -= 0.0;
      break;
  }

  // --- Temperature compensation ---
  // Air expands ~1/273 per °C (ideal gas law). Pressure change ~0.07 PSI/°C
  const tempDiff = temperatureC - REF_TEMP_C;
  frontPsi += tempDiff * 0.07;
  rearPsi += tempDiff * 0.07;

  // --- Humidity adjustment ---
  // High humidity → more tacky trails → can run slightly lower pressure for grip
  if (humidityPct >= 70) {
    frontPsi -= 0.5;
    rearPsi -= 0.3;
  } else if (humidityPct <= 30) {
    // Very dry → loose terrain → slightly higher to avoid burping
    frontPsi += 0.5;
    rearPsi += 0.3;
  }

  // --- Safety minimums (tubeless) ---
  const minPsi = profile.tubeless ? 14 : 18;
  const maxPsi = 40;
  frontPsi = Math.max(minPsi, Math.min(maxPsi, frontPsi));
  rearPsi = Math.max(minPsi + 1, Math.min(maxPsi, rearPsi));

  // Round to 0.5 PSI increments (realistic pump accuracy)
  frontPsi = Math.round(frontPsi * 2) / 2;
  rearPsi = Math.round(rearPsi * 2) / 2;

  // Initial pressures (could be different from calculated)
  const currentFrontPsi = profile.initialPressureFrontBar * PSI_PER_BAR;
  const currentRearPsi = profile.initialPressureRearBar * PSI_PER_BAR;

  // Build reason string
  const parts: string[] = [];
  parts.push(`Basada en ${totalWeightKg}kg totales`);
  if (profile.tubeless) parts.push('tubeless');
  parts.push(`${frontWidthIn.toFixed(1)}" delantera / ${rearWidthIn.toFixed(1)}" trasera`);
  if (tempDiff !== 0) parts.push(`ajuste térmico ${tempDiff > 0 ? '+' : ''}${tempDiff.toFixed(0)}°C`);
  if (humidityPct >= 70) parts.push('suelo húmedo → +agarre');
  else if (humidityPct <= 30) parts.push('suelo seco → +seguridad');
  parts.push(`terreno ${terrainType}`);

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
    adjustedTemp: temperatureC,
    terrainType,
    reason: parts.join(' · '),
  };
}
