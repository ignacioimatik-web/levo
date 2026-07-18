import type { Metadata } from 'next';
import CommunityFeed from '@/components/social/CommunityFeed';

export const metadata: Metadata = {
  title: 'Comunidad MTB | E-nduro Ebiketracks',
  description: 'Actividades públicas, rutas, kudos y conversación de la comunidad MTB y e-bike.',
};

export default function CommunityPage() {
  return <CommunityFeed />;
}
