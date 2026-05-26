import type { RouteSegment } from '@/lib/route-analysis';

export type SegmentRiskLevel = 'low' | 'medium' | 'high';

export interface SegmentRiskResult {
  score: number;
  level: SegmentRiskLevel;
  reason: string;
}

export interface WeatherRiskInput {
  riskLevel?: 'green' | 'yellow' | 'red';
  precipitationMm?: number;
  maxWindKmh?: number;
  windKmh?: number;
}

export function assessSegmentRisk(segment: RouteSegment, weather?: WeatherRiskInput | null): SegmentRiskResult {
  const weatherPenalty = weather?.riskLevel === 'red' ? 2 : weather?.riskLevel === 'yellow' ? 1 : 0;
  const slopePenalty = Math.abs(segment.avgSlopePct) >= 12 ? 2 : Math.abs(segment.avgSlopePct) >= 8 ? 1 : 0;
  const typePenalty = segment.type === 'descent' ? 1 : 0;
  const wind = weather?.maxWindKmh ?? weather?.windKmh ?? 0;
  const windPenalty = wind >= 35 ? 1 : 0;
  const rainPenalty = (weather?.precipitationMm ?? 0) >= 2 ? 1 : 0;

  const score = weatherPenalty + slopePenalty + typePenalty + windPenalty + rainPenalty;
  const level: SegmentRiskLevel = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  const reason =
    level === 'high'
      ? 'Pendiente o condicion meteo exigente para este tramo.'
      : level === 'medium'
      ? 'Tramo con atencion tecnica/moderada segun condiciones.'
      : 'Tramo generalmente gestionable con tecnica normal.';

  return { score, level, reason };
}
