import type { Metadata } from 'next';
import PersonalHeatmap from '@/components/activity/PersonalHeatmap';

export const metadata: Metadata = {
  title: 'Mapa personal',
  description: 'Mapa de calor privado con todas tus rutas MTB y e-bike.',
};

export default function PersonalMapPage() {
  return <PersonalHeatmap />;
}
