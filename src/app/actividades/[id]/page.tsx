import type { Metadata } from 'next';
import ActivityDetail from '@/components/activity/ActivityDetail';

export const metadata: Metadata = {
  title: 'Detalle de actividad | E-nduro Ebiketracks',
  description: 'Mapa, perfil y métricas de una actividad MTB o e-bike.',
};

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityDetail activityId={id} />;
}
