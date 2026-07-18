'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function FollowButton({
  targetUserId,
  onChange,
}: {
  targetUserId: string;
  onChange?: (following: boolean) => void;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setViewerId(user?.id ?? null);
      if (!user || user.id === targetUserId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      if (active) {
        setFollowing(Boolean(data));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [targetUserId]);

  if (loading) {
    return (
      <span className="grid min-h-11 min-w-28 place-items-center rounded-xl border border-white/10 bg-slate-900">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </span>
    );
  }
  if (!viewerId) {
    return (
      <Link
        href={`/auth?next=${encodeURIComponent(`/riders/${targetUserId}`)}`}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-black uppercase"
      >
        <UserPlus className="h-4 w-4" /> Seguir
      </Link>
    );
  }
  if (viewerId === targetUserId) {
    return (
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase text-slate-300"
      >
        Editar perfil
      </Link>
    );
  }

  const toggle = async () => {
    if (saving) return;
    const supabase = createClient();
    if (!supabase) return;
    const previous = following;
    const next = !previous;
    setFollowing(next);
    setSaving(true);
    const { error } = next
      ? await supabase.from('user_follows').insert({
        follower_id: viewerId,
        following_id: targetUserId,
      })
      : await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', viewerId)
        .eq('following_id', targetUserId);
    if (error) setFollowing(previous);
    else onChange?.(next);
    setSaving(false);
  };

  return (
    <button
      type="button"
      onClick={() => { void toggle(); }}
      disabled={saving}
      aria-pressed={following}
      className={`inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black uppercase transition disabled:opacity-60 ${
        following
          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'bg-orange-500 text-white'
      }`}
    >
      {saving
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : following
          ? <Check className="h-4 w-4" />
          : <UserPlus className="h-4 w-4" />}
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}
