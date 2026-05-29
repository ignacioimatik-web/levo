'use client';

import dynamic from 'next/dynamic';
import type { TrackMTB } from '@/lib/forfait/types';

const VistaForfaitEE = dynamic(() => import('@/components/vista-forfait-ee/VistaForfaitEE'), { ssr: false });

export default function VistaForfaitEEDynamic({ tracks }: { tracks: TrackMTB[] }) {
  return <VistaForfaitEE tracks={tracks} />;
}
