import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { normalizeAuthNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import RiderOnboarding from './RiderOnboarding';

export const metadata: Metadata = {
  title: 'Configura tu experiencia',
  description: 'Personaliza LEVO para tu bici, batería y forma de rodar.',
  robots: { index: false, follow: false },
};

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = normalizeAuthNextPath(requestedNext);
  const user = await requireAuth('/account');
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bike_name, battery_capacity_wh, home_region, rider_type, onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect(next);

  const displayName =
    profile?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Rider';

  return (
    <RiderOnboarding
      userId={user.id}
      next={next}
      initialDisplayName={displayName}
      initialBikeName={profile?.bike_name ?? ''}
      initialBatteryCapacityWh={profile?.battery_capacity_wh ?? 700}
      initialHomeRegion={profile?.home_region ?? ''}
      initialRiderType={profile?.rider_type ?? 'both'}
    />
  );
}
