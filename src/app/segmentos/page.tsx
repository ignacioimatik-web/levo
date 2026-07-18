import type { Metadata } from 'next';
import { SegmentExplorer } from '@/components/segments/SegmentExplorer';

export const metadata: Metadata = {
  title: 'Segmentos MTB y e-bike',
  description: 'Récords personales y clasificaciones separadas para segmentos MTB y e-bike sobre tracks GPS reales.',
};

export default function SegmentsPage() {
  return <SegmentExplorer />;
}
