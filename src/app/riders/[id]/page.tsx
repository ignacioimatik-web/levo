import type { Metadata } from 'next';
import RiderProfile from '@/components/social/RiderProfile';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: 'Perfil rider',
  description: 'Actividad, rutas y estadísticas MTB y e-bike.',
  robots: { index: false, follow: true },
};

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RiderProfile riderId={UUID_PATTERN.test(id) ? id : ''} />;
}
