import type { Metadata } from 'next';
import RideRecorder from '@/components/activity/RideRecorder';
import { batteryLaunchSettingsFromSearchParams } from '@/lib/activities/battery-launch';

export const metadata: Metadata = {
  title: 'Grabar salida | E-nduro Ebiketracks',
  description: 'Graba una salida MTB o e-bike con GPS, desnivel, velocidad y autonomía.',
};

export default async function RecordRidePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ruta = Array.isArray(params.ruta) ? params.ruta[0] : params.ruta;
  return (
    <RideRecorder
      plannedRouteId={ruta}
      initialBatterySettings={batteryLaunchSettingsFromSearchParams(params)}
    />
  );
}
