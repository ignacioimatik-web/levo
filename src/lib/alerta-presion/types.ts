export interface BikeProfile {
  id?: string;
  userId?: string;
  riderWeightKg: number;
  bikeWeightKg: number;
  bikeModel: string;
  wheelType: '29' | '27.5' | '29-front-27.5-rear' | '26';
  tireModelFront: string;
  tireModelRear: string;
  tireWidthFrontMm: number;
  tireWidthRearMm: number;
  initialPressureFrontBar: number;
  initialPressureRearBar: number;
  tubeless: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PressureRecommendation {
  currentFrontBar: number;
  currentRearBar: number;
  recommendedFrontBar: number;
  recommendedRearBar: number;
  currentFrontPsi: number;
  currentRearPsi: number;
  recommendedFrontPsi: number;
  recommendedRearPsi: number;
  temperatureC: number;
  humidityPct: number;
  adjustedTemp: number;
  terrainType: 'enduro' | 'dh' | 'trail';
  reason: string;
}

export interface CalculationInput {
  profile: BikeProfile;
  temperatureC: number;
  humidityPct: number;
  difficulty: 'rojo' | 'negro' | 'doble-negro';
  sector: string;
  trackName: string;
}
