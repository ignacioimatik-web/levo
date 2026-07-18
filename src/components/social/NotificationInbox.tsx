'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCheck, Heart, Loader2, MessageCircle, UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import {
  notificationDestination, notificationMessage, notificationRelativeTime,
  type SocialNotificationType,
} from '@/lib/social/notifications';
import { NOTIFICATIONS_READ_EVENT } from './NotificationBell';

interface NotificationRow {
  id: string;
  actor_id: string;
  type: SocialNotificationType;
  activity_id: string | null;
  created_at: string;
  read_at: string | null;
}

interface ActorProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ActivitySummary {
  id: string;
  title: string;
}

export default function NotificationInbox({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ActorProfile>>({});
  const [activities, setActivities] = useState<Record<string, ActivitySummary>>({});
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError('Las notificaciones no están disponibles en este entorno.');
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from('notifications')
      .select('id,actor_id,type,activity_id,created_at,read_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(80);
    if (loadError) {
      setError('No hemos podido cargar tus notificaciones.');
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as NotificationRow[];
    const actorIds = [...new Set(rows.map((row) => row.actor_id))];
    const activityIds = [...new Set(rows.flatMap((row) => row.activity_id ? [row.activity_id] : []))];
    const [{ data: actorRows }, { data: activityRows }] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles').select('user_id,display_name,avatar_url').in('user_id', actorIds)
        : Promise.resolve({ data: [] }),
      activityIds.length
        ? supabase.from('activities').select('id,title').in('id', activityIds)
        : Promise.resolve({ data: [] }),
    ]);
    setNotifications(rows);
    setProfiles(Object.fromEntries(
      ((actorRows ?? []) as ActorProfile[]).map((profile) => [profile.user_id, profile]),
    ));
    setActivities(Object.fromEntries(
      ((activityRows ?? []) as ActivitySummary[]).map((activity) => [activity.id, activity]),
    ));
    setError('');
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    const supabase = createClient();
    if (!supabase) return () => window.clearTimeout(initialLoad);
    const channel = supabase
      .channel(`notification-inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => { void load(); },
      )
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  const markAllRead = async () => {
    if (marking || unreadCount === 0) return;
    const supabase = createClient();
    if (!supabase) return;
    setMarking(true);
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (!updateError) {
      setNotifications((rows) => rows.map((row) => row.read_at ? row : { ...row, read_at: readAt }));
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    }
    setMarking(false);
  };

  const markOneRead = async (notification: NotificationRow) => {
    if (notification.read_at) return;
    const supabase = createClient();
    if (!supabase) return;
    const readAt = new Date().toISOString();
    setNotifications((rows) => rows.map((row) => row.id === notification.id ? { ...row, read_at: readAt } : row));
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notification.id)
      .eq('recipient_id', userId);
    if (updateError) void load();
    else window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  };

  if (loading) {
    return <div className="grid min-h-80 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-orange-400" /></div>;
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400"><Bell className="h-4 w-4" /> Tu actividad social</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Notificaciones</h1>
          <p className="mt-2 text-sm text-slate-400">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Estás al día'}</p>
        </div>
        <button
          type="button"
          onClick={() => { void markAllRead(); }}
          disabled={marking || unreadCount === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase text-slate-300 disabled:opacity-40"
        >
          {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Marcar leídas
        </button>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{error}</p>
      ) : notifications.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-16 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-600" />
          <h2 className="mt-4 text-xl font-black">Todo tranquilo por aquí</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Cuando alguien te siga, comente una salida o te dé kudos, lo verás aquí.</p>
          <Link href="/comunidad" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-5 text-xs font-black uppercase">Ir a Comunidad</Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
          {notifications.map((notification) => {
            const profile = profiles[notification.actor_id];
            const actorName = profile?.display_name?.trim() || 'Un rider';
            const activityTitle = notification.activity_id
              ? activities[notification.activity_id]?.title || 'tu salida'
              : null;
            const href = notificationDestination(
              notification.type,
              notification.actor_id,
              notification.activity_id,
            );
            const Icon = notification.type === 'follow'
              ? UserPlus
              : notification.type === 'kudo'
                ? Heart
                : MessageCircle;
            const message = notificationMessage(notification.type, activityTitle);

            return (
              <Link
                key={notification.id}
                href={href}
                onClick={() => { void markOneRead(notification); }}
                className={`relative flex min-h-20 items-center gap-3 border-b border-white/5 p-4 transition last:border-b-0 hover:bg-white/[0.03] sm:p-5 ${
                  notification.read_at ? '' : 'bg-orange-500/[0.04]'
                }`}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500/15 text-sm font-black text-orange-300">{actorName.charAt(0).toUpperCase()}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-relaxed text-slate-300">
                    <strong className="text-white">{actorName}</strong> {message}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{notificationRelativeTime(notification.created_at)}</span>
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-orange-400"><Icon className="h-4 w-4" /></span>
                {!notification.read_at && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-400" />}
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
