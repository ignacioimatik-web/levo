import type { Metadata } from 'next';
import ProgressDashboard from '@/components/progress/ProgressDashboard';

export const metadata: Metadata = {
  title: 'Mi progreso | E-nduro Ebiketracks',
  description: 'Objetivos, tendencias, récords y eficiencia de batería para MTB y e-bike.',
};

export default function ProgressPage() {
  return <ProgressDashboard />;
}
