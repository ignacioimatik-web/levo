import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicActivityView from '@/components/activity/PublicActivityView';
import { getPublicActivity } from '@/lib/activities/public';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const activity = await getPublicActivity(id);
  if (!activity) {
    return {
      title: 'Actividad no disponible',
      robots: { index: false, follow: false },
    };
  }
  const description = `${activity.riderName}: ${(activity.distanceM / 1000).toFixed(1)} km, ${Math.round(activity.elevationGainM)} m+ y ${activity.averageSpeedKmh.toFixed(1)} km/h de media.`;
  return {
    title: activity.title,
    description,
    openGraph: {
      type: 'article',
      title: activity.title,
      description,
    },
  };
}

export default async function PublicActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getPublicActivity(id);
  if (!activity) notFound();
  return <PublicActivityView activity={activity} />;
}
