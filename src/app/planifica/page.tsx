import type { Metadata } from 'next';
import UniversalRoutePlanner from '@/components/planner/UniversalRoutePlanner';

export const metadata: Metadata = {
  title: 'Crear ruta MTB | E-nduro Ebiketracks',
  description: 'Dibuja o importa una ruta MTB y analiza desnivel, meteo AEMET por tramos, ritmo, luz y autonomía.',
};

export default function PlanificaPage() {
  return <UniversalRoutePlanner />;
}
