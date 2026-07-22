/**
 * Alerta Presión — MTB tire pressure calculation
 *
 * Updated with Schwalbe Pressure Prof methodology (9 parameters).
 *
 * Parameters:
 *   1. Total weight (rider + bike)
 *   2. Tire width (inches / mm)
 *   3. Rim internal width (mm)
 *   4. Riding style
 *   5. Rider experience
 *   6. Terrain type
 *   7. Ground conditions
 *   8. Tube/tubeless/insert system
 *   9. Casing type
 *   + Temperature & humidity adjustments
 */
import type { BikeProfile, CalculationInput, PressureRecommendation } from './types';

const PSI_PER_BAR = 14.504;
const REF_TEMP_C = 20;
const REF_WEIGHT_KG = 95;         // 80 rider + 15 bike
const REF_WIDTH_IN = 2.3;
const REF_FRONT_PSI = 23;
const REF_REAR_PSI = 26;

// Terrain adjustments (delta PSI)
const TERRAIN_ADJ: Record<string, { front: number; rear: number; label: string }> = {
  mixto:    { front: 0, rear: 0, label: 'terreno mixto' },
  raices:   { front: -2, rear: -1, label: 'raíces → -presión (tracción)' },
  arcilloso:{ front: -2.5, rear: -1.5, label: 'arcilloso/blando → -presión' },
  duro:     { front: 1.5, rear: 1, label: 'terreno duro → +presión' },
  rocoso:   { front: -1, rear: 0.5, label: 'rocoso → delantera suave, trasera firme' },
};

// Ground condition adjustments
const GROUND_ADJ: Record<string, { front: number; rear: number; label: string }> = {
  humedo: { front: -1.5, rear: -1, label: 'suelo húmedo → -presión (agarre)' },
  mixto:  { front: 0, rear: 0, label: 'condiciones mixtas' },
  seco:   { front: 1, rear: 0.5, label: 'suelo seco → +presión' },
};

// Riding style adjustments
const STYLE_ADJ: Record<string, { front: number; rear: number; label: string }> = {
  conservador: { front: 1.5, rear: 1, label: 'estilo conservador → +presión' },
  moderado:    { front: 0, rear: 0, label: '' },
  agresivo:    { front: -2, rear: -1, label: 'estilo agresivo → -presión' },
};

// Experience adjustments
const EXP_ADJ: Record<string, { front: number; rear: number; label: string }> = {
  principiante: { front: 2, rear: 1.5, label: 'principiante → +presión (seguridad)' },
  intermedio:   { front: 0, rear: 0, label: '' },
  avanzado:     { front: -1, rear: -0.5, label: 'avanzado → -presión (rendimiento)' },
  experto:      { front: -2, rear: -1, label: 'experto → -presión (máximo agarre)' },
};

// Casing type adjustments
const CASING_ADJ: Record<string, { front: number; rear: number; label: string }> = {
  ligera:    { front: -1, rear: -0.5, label: 'carcasa ligera → -presión' },
  estandar:  { front: 0, rear: 0, label: '' },
  reforzada: { front: 1.5, rear: 1, label: 'carcasa reforzada → +presión' },
};

function barToPsi(bar: number): number {
  return Math.round(bar * PSI_PER_BAR * 10) / 10;
}
function psiToBar(psi: number): number {
  return Math.round((psi / PSI_PER_BAR) * 100) / 100;
}

// Convert tire width in inches to approximate mm
function inchToMm(inches: number): number {
  return Math.round(inches * 25.4);
}

export function calculatePressure(input: CalculationInput): PressureRecommendation {
  const { profile, temperatureC, humidityPct } = input;
  const totalKg = profile.riderWeightKg + profile.bikeWeightKg;

  // Scale from reference weight and tire width
  const frontScale = (totalKg / REF_WEIGHT_KG) * (REF_WIDTH_IN / profile.tireWidthFrontInch);
  const rearScale  = (totalKg / REF_WEIGHT_KG) * (REF_WIDTH_IN / profile.tireWidthRearInch);

  let frontPsi = REF_FRONT_PSI * frontScale;
  let rearPsi  = REF_REAR_PSI  * rearScale;

  // --- Rim width adjustment ---
  // Narrower rim = higher pressure, wider rim = lower pressure (reference ~30mm internal)
  if (profile.rimWidthMm && profile.rimWidthMm > 0) {
    const rimDiff = (profile.rimWidthMm - 30) * 0.15;
    frontPsi -= rimDiff;
    rearPsi  -= rimDiff;
  }

  // --- Tubeless / system ---
  if (profile.tubeless) { frontPsi -= 2.5; rearPsi -= 2.0; }
  // --- Insert (foam insert allows lower pressure safely) ---
  if (profile.hasInsert) { frontPsi -= 1.5; rearPsi -= 1.0; }

  // --- Technical descent (grip baseline) ---
  frontPsi -= 2.0;
  rearPsi  -= 1.0;

  // --- Terrain type ---
  const terrain = profile.terrainType ? TERRAIN_ADJ[profile.terrainType] : null;
  if (terrain) { frontPsi += terrain.front; rearPsi += terrain.rear; }

  // --- Ground conditions ---
  const ground = profile.groundCondition ? GROUND_ADJ[profile.groundCondition] : null;
  if (ground) { frontPsi += ground.front; rearPsi += ground.rear; }

  // --- Riding style ---
  const style = profile.ridingStyle ? STYLE_ADJ[profile.ridingStyle] : null;
  if (style) { frontPsi += style.front; rearPsi += style.rear; }

  // --- Rider experience ---
  const exp = profile.riderExperience ? EXP_ADJ[profile.riderExperience] : null;
  if (exp) { frontPsi += exp.front; rearPsi += exp.rear; }

  // --- Casing type ---
  const casing = profile.casingType ? CASING_ADJ[profile.casingType] : null;
  if (casing) { frontPsi += casing.front; rearPsi += casing.rear; }

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
  const maxPsi = 45;
  frontPsi = Math.max(minFront, Math.min(maxPsi, frontPsi));
  rearPsi  = Math.max(minRear,  Math.min(maxPsi, rearPsi));

  // Round to 0.5 PSI
  frontPsi = Math.round(frontPsi * 2) / 2;
  rearPsi  = Math.round(rearPsi * 2) / 2;

  const currentFrontPsi = profile.initialPressureFrontBar * PSI_PER_BAR;
  const currentRearPsi  = profile.initialPressureRearBar * PSI_PER_BAR;

  // Build reason string
  const parts: string[] = [
    `${totalKg}kg totales`,
    profile.tubeless ? 'tubeless' : 'cámara',
    profile.hasInsert ? 'con insert' : '',
    `${profile.tireWidthFrontInch.toFixed(1)}" del. / ${profile.tireWidthRearInch.toFixed(1)}" tras.`,
  ].filter(Boolean);
  if (profile.rimWidthMm) parts.push(`llanta ${profile.rimWidthMm}mm`);
  if (terrain && terrain.label) parts.push(terrain.label);
  if (ground && ground.label) parts.push(ground.label);
  if (style && style.label) parts.push(style.label);
  if (exp && exp.label) parts.push(exp.label);
  if (casing && casing.label) parts.push(casing.label);

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
