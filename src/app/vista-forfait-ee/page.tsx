import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';
import VistaForfaitEEDynamic from '@/components/vista-forfait-ee/VistaForfaitEEDynamic';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gpxtour.vercel.app';

export const metadata = {
  title: 'Vista Forfait Earth Engine',
  description: 'Explora las sendas del bike resort con Google Earth Engine.',
  openGraph: {
    title: 'Vista Forfait Earth Engine | E-nduro Ebiketracks',
    description: 'Mapa satelital con Google Earth Engine.',
    images: [{ url: `${siteUrl}/images/logo-enduro-ebiketracks.png`, width: 1200, height: 630, alt: 'E-nduro Ebiketracks' }],
  },
};

export default async function VistaForfaitEEPage() {
  const allTracks = await loadRealTracks(routes);
  return <VistaForfaitEEDynamic tracks={allTracks} />;
}
