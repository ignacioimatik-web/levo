import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  COMPETITIVE_SEGMENTS,
  getCompetitiveSegment,
} from '@/data/competitive-segments';
import { SegmentDetail } from '@/components/segments/SegmentDetail';

export function generateStaticParams() {
  return COMPETITIVE_SEGMENTS.map((segment) => ({ id: segment.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const segment = getCompetitiveSegment(id);
  if (!segment) return {};
  return {
    title: `${segment.name} | Segmento ${segment.type === 'climb' ? 'de subida' : 'de descenso'}`,
    description: `${(segment.distanceM / 1000).toFixed(2)} km, ${segment.elevationDeltaM} m y ${segment.averageGradePct}% en ${segment.region}.`,
  };
}

export default async function SegmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = getCompetitiveSegment(id);
  if (!segment) notFound();
  return <SegmentDetail segment={segment} />;
}
