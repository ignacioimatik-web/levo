import type { Metadata } from 'next';
import { SegmentExplorer } from '@/components/segments/SegmentExplorer';

export const metadata: Metadata = {
  title: 'Mis segmentos MTB y e-bike',
  description: 'Récords personales MTB y e-bike sobre tracks GPS reales.',
};

export default function SegmentsPage() {
  return <SegmentExplorer />;
}
