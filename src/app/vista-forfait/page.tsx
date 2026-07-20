import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';
import VistaForfait from '@/components/vista-forfait/VistaForfait';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gpxtour.vercel.app';

export const metadata = {
  title: 'Vista Forfait',
  openGraph: {
    title: 'Vista Forfait | E-nduro Ebiketracks',
    description: 'Explora las sendas del bike resort en 3D con Mapbox. Vista panorámica interactiva.',
    images: [{ url: `${siteUrl}/images/logo-enduro-ebiketracks.png`, width: 1200, height: 630, alt: 'E-nduro Ebiketracks' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vista Forfait | E-nduro Ebiketracks',
    description: 'Explora las sendas del bike resort en 3D con Mapbox.',
    images: [`${siteUrl}/images/logo-enduro-ebiketracks.png`],
  },
};

export default async function VistaForfaitPage() {
  const allTracks = await loadRealTracks(routes);
  return <VistaForfait tracks={allTracks} />;
}
