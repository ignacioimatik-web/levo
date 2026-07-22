export interface BikeProfile {
  id?: string;
  userId?: string;
  riderWeightKg: number;
  bikeWeightKg: number;
  bikeModel: string;
  wheelFront: '29' | '27.5';
  wheelRear: '29' | '27.5';
  tireModelFront: string;
  tireModelRear: string;
  tireWidthFrontInch: number;
  tireWidthRearInch: number;
  initialPressureFrontBar: number;
  initialPressureRearBar: number;
  tubeless: boolean;
  hasInsert?: boolean;
  rimWidthMm?: number;
  ridingStyle?: 'conservador' | 'moderado' | 'agresivo';
  riderExperience?: 'principiante' | 'intermedio' | 'avanzado' | 'experto';
  terrainTypes?: string[];
  groundCondition?: 'humedo' | 'mixto' | 'seco';
  casingType?: 'ligera' | 'estandar' | 'reforzada';
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
  terrainType: 'enduro' | 'dh' | 'trail';
  reason: string;
}

export interface DescentInfo {
  id: string;
  name: string;
  trackName: string;
  distanceKm: number;
  elevationLoss: number;
  elevationGain: number;
  midpoint: { lat: number; lng: number };
}

export interface CalculationInput {
  profile: BikeProfile;
  temperatureC: number;
  humidityPct: number;
  descent: DescentInfo;
}
