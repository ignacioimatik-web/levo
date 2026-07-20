import type { Metadata } from 'next';
import UniversalRoutePlanner from '@/components/planner/UniversalRoutePlanner';

export const metadata: Metadata = {
  title: 'Crear ruta MTB | E-nduro Ebiketracks',
  description: 'Dibuja o importa una ruta MTB y analiza desnivel, meteo AEMET por tramos, ritmo, luz y autonomía.',
};

type PageProps = {
  searchParams: Promise<{ gpx?: string; name?: string }>;
};

export default async function PlanificaPage({ searchParams }: PageProps) {
  const { gpx, name } = await searchParams;
  const initialGpxUrl = typeof gpx === 'string' && /^\/tracks\/[^/?#]+\.gpx$/i.test(gpx)
    ? gpx
    : undefined;
  return (
    <UniversalRoutePlanner
      initialGpxUrl={initialGpxUrl}
      initialRouteName={typeof name === 'string' ? name.slice(0, 120) : undefined}
    />
  );
}
