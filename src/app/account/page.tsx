import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { Mail, Globe, Calendar, Shield, Sparkles } from 'lucide-react';
import Image from 'next/image';
import SignOutButton from './SignOutButton';
import ProfileSettings from './ProfileSettings';
import Link from 'next/link';

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  google: { label: 'Google', color: 'text-orange-400' },
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
        <Image
          src={avatarUrl}
          alt={displayName}
          width={80}
          height={80}
          unoptimized
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
  const user = await requireAuth('/account');
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

        {!profile?.onboarding_completed_at && (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
              <div>
                <p className="text-sm font-black text-white">Personaliza LEVO para tus salidas</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Configura modalidad, bici y batería para mejorar autonomía, ritmo y recomendaciones.
                </p>
                <Link href="/onboarding" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 text-xs font-black uppercase text-white">
                  Completar configuración
                </Link>
              </div>
            </div>
          </div>
        )}

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
