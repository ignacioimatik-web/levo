import type { Metadata } from 'next';
import MaintenanceDashboard from '@/components/maintenance/MaintenanceDashboard';

export const metadata: Metadata = {
  title: 'Mi taller',
  description: 'Mantenimiento por kilometraje para MTB y e-bike.',
};

export default function MaintenancePage() {
  return <MaintenanceDashboard />;
}
