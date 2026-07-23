import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';
import VistaForfait from '@/components/vista-forfait/VistaForfait';

export const metadata = {
  title: 'Vista Forfait',
  openGraph: {
    title: 'Vista Forfait | E-nduro Ebiketracks',
    description: 'Explora las sendas del bike resort en 3D con Mapbox. Vista panorámica interactiva.',
    images: [{ url: 'https://gpxtour.vercel.app/images/logo-enduro-ebiketracks.png', width: 1200, height: 630, alt: 'E-nduro Ebiketracks' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vista Forfait | E-nduro Ebiketracks',
    description: 'Explora las sendas del bike resort en 3D con Mapbox.',
    images: [{ url: 'https://gpxtour.vercel.app/images/logo-enduro-ebiketracks.png', width: 1200, height: 630, alt: 'E-nduro Ebiketracks' }],
  },
};

export default async function VistaForfaitPage() {
  const allTracks = await loadRealTracks(routes);
  return <VistaForfait tracks={allTracks} />;
}
