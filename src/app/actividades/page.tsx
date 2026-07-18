import type { Metadata } from 'next';
import ActivityHistory from '@/components/activity/ActivityHistory';

export const metadata: Metadata = {
  title: 'Mis actividades | E-nduro Ebiketracks',
  description: 'Historial de salidas MTB y e-bike, métricas y exportación GPX.',
};

export default function ActivitiesPage() {
  return <ActivityHistory />;
}
