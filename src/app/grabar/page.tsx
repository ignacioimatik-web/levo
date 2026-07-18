import type { Metadata } from 'next';
import RideRecorder from '@/components/activity/RideRecorder';

export const metadata: Metadata = {
  title: 'Grabar salida | E-nduro Ebiketracks',
  description: 'Graba una salida MTB o e-bike con GPS, desnivel, velocidad y autonomía.',
};

export default async function RecordRidePage({
  searchParams,
}: {
  searchParams: Promise<{ ruta?: string }>;
}) {
  const { ruta } = await searchParams;
  return <RideRecorder plannedRouteId={ruta} />;
}
