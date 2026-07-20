import type { Metadata } from 'next';
import LiveTrackingView from '@/components/live/LiveTrackingView';

export const metadata: Metadata = {
  title: 'Seguimiento en directo | E-nduro Ebiketracks',
  description: 'Última posición compartida de una salida MTB o e-bike.',
  robots: { index: false, follow: false },
};

export default async function LiveTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <LiveTrackingView token={token} />;
}
