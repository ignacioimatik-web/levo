import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';
import VistaForfait from '@/components/vista-forfait/VistaForfait';

export const metadata = {
  title: 'Vista Forfait',
};

export default async function VistaForfaitPage() {
  const allTracks = await loadRealTracks(routes);
  return <VistaForfait tracks={allTracks} />;
}
