export type PressureDifficulty = 'verde' | 'azul' | 'rojo' | 'negro' | 'doble-negro';

export interface TirePressureInputs {
  riderWeightKg: number;
  bikeWeightKg: number;
  wheelSize: string;
  currentFrontBar: number;
  currentRearBar: number;
  temperatureC: number | null;
  humidityPct: number | null;
  difficulty: PressureDifficulty;
}

export interface TirePressureRecommendation {
  frontBar: number;
  rearBar: number;
  totalWeightKg: number;
  confidence: 'alta' | 'media' | 'baja';
  note: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

/** A conservative starting point, not a substitute for the tyre manufacturer's limit. */
export function recommendTirePressure(input: TirePressureInputs): TirePressureRecommendation {
  const totalWeightKg = clamp(input.riderWeightKg + input.bikeWeightKg, 35, 310);
  const wheelAdjustment = input.wheelSize.includes('27') ? 0.04 : input.wheelSize.includes('26') ? 0.07 : 0;
  const terrainAdjustment = input.difficulty === 'doble-negro' || input.difficulty === 'negro' ? -0.08 : input.difficulty === 'rojo' ? -0.04 : 0;
  const temperatureAdjustment = input.temperatureC == null ? 0 : clamp((input.temperatureC - 20) * 0.002, -0.04, 0.06);
  const humidityAdjustment = input.humidityPct == null ? 0 : input.humidityPct >= 80 ? 0.02 : input.humidityPct <= 35 ? -0.01 : 0;
  const loadAdjustment = (totalWeightKg - 85) * 0.0045;
  const rearBar = clamp(1.45 + loadAdjustment + wheelAdjustment + terrainAdjustment + temperatureAdjustment + humidityAdjustment, 1.05, 2.45);
  const frontBar = clamp(rearBar - 0.14, 0.95, 2.3);
  const confidence = input.temperatureC != null && input.humidityPct != null ? 'alta' : input.temperatureC != null || input.humidityPct != null ? 'media' : 'baja';
  return {
    frontBar: round(frontBar),
    rearBar: round(rearBar),
    totalWeightKg: round(totalWeightKg),
    confidence,
    note: 'Recomendación de partida para un descenso técnico. Comprueba el límite del neumático y ajusta según carcasa, terreno y tacto.',
  };
}
