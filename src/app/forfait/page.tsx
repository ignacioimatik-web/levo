import ForfaitBuilder from '@/components/forfait/ForfaitBuilder';
import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';

export default async function ForfaitPage() {
  const allTracks = await loadRealTracks(routes);
  return <ForfaitBuilder tracks={allTracks} />;
}
