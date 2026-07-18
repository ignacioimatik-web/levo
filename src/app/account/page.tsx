import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { Mail, Globe, Calendar, Shield } from 'lucide-react';
import SignOutButton from './SignOutButton';
import ProfileSettings from './ProfileSettings';
import Link from 'next/link';

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  google: { label: 'Google', color: 'text-orange-400' },
  apple: { label: 'Apple', color: 'text-slate-300' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ProviderBadge({ provider }: { provider: string }) {
  const info = PROVIDER_LABELS[provider] ?? { label: provider, color: 'text-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-white/5 border border-white/10 ${info.color}`}>
      {info.label}
    </span>
  );
}

function AvatarSection({ avatarUrl, displayName, email }: { avatarUrl?: string | null; displayName: string; email?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-20 h-20 rounded-full object-cover border-2 border-white/10"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-400">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold heading-gradient-strong">{displayName}</h1>
        <p className="text-slate-400 mt-1">{email}</p>
      </div>
    </div>
  );
}

export default async function AccountPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || 'email';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';

  return (
    <div className="py-12 px-6 max-w-2xl mx-auto min-h-screen">
      <div className="mb-8">
        <div className="inline-block mb-2 h-1 w-12 bg-orange-500"></div>
        <h2 className="text-3xl md:text-4xl font-bold heading-gradient-strong">
          Mi cuenta
        </h2>
      </div>

      <div className="glass-card rounded-2xl p-8 space-y-8">
        <AvatarSection avatarUrl={avatarUrl} displayName={displayName} email={user.email} />

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-slate-400">Email:</span>
            <span className="text-slate-200 font-medium">{user.email}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Globe className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-slate-400">Proveedor:</span>
            <ProviderBadge provider={provider} />
          </div>

          {user.created_at && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-slate-400">Registrado:</span>
              <span className="text-slate-200 font-medium">{formatDate(user.created_at)}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-slate-400">Rol:</span>
            <span className="text-slate-200 font-medium capitalize">rider</span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10">
          <Link href={`/riders/${user.id}`} className="mb-5 inline-flex min-h-11 items-center rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 text-xs font-black uppercase text-orange-300">
            Ver mi perfil rider
          </Link>
          <ProfileSettings
            userId={user.id}
            initialDisplayName={displayName}
            initialBikeName={profile?.bike_name ?? ''}
            initialBatteryCapacityWh={profile?.battery_capacity_wh ?? 700}
            initialBio={profile?.bio ?? ''}
            initialHomeRegion={profile?.home_region ?? ''}
            initialRiderType={profile?.rider_type ?? 'both'}
          />
        </div>

        <div className="pt-4 border-t border-white/10">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
