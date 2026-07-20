'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';
import {
  flushPendingActivityDeletes,
  pullActivities,
  syncActivity,
} from '@/lib/activities/sync';
import { getActivitiesDurable } from '@/lib/activities/storage';

/**
 * Keeps the local-first activity journal convergent without requiring the
 * rider to remember a manual "Sincronizar" action after leaving coverage.
 * It is deliberately invisible and throttled by an in-flight guard; the
 * activity list remains the source of truth if the network is unavailable.
 */
export default function ActivitySyncBridge() {
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return undefined;

    let running = false;
    let cancelled = false;

    const run = async () => {
      if (cancelled || running || !navigator.onLine) return;
      running = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        await flushPendingActivityDeletes();
        const activities = await getActivitiesDurable();
        for (const activity of activities) {
          if (cancelled) return;
          if (activity.syncStatus !== 'synced') await syncActivity(activity);
        }
        await pullActivities();
      } catch {
        // Local storage remains authoritative until the next online/visible
        // event. A transient network failure must never interrupt navigation.
      } finally {
        running = false;
      }
    };

    const schedule = () => { void run(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') window.setTimeout(schedule, 0);
    }).data.subscription;

    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const initialTimer = window.setTimeout(schedule, 1_500);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.removeEventListener('online', schedule);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
