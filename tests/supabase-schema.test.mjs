import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);

const productionMigrationHashes = new Map([
  ['20260718055801_create_profiles_and_activities.sql', '8b428582c7f817ed67b7dd8e7bc6e707'],
  ['20260718055820_restrict_internal_function_execution.sql', '0d98c5a735d0fe7de35be251ac8a7f6c'],
  ['20260718061448_create_saved_routes_for_navigation.sql', '3dc2ad7358c0269d3aa1580e0969296a'],
  ['20260718063019_add_social_feed_kudos_and_comments.sql', '3903f755f7ec6692f0af4efdf1f0672a'],
  ['20260718063916_create_private_token_live_tracking.sql', 'f25b5d889a20c3b39a004949f272bfb2'],
  ['20260718080959_create_private_bike_maintenance.sql', '8fe1d88fdd9a1f84e5b0c73759fe93a4'],
  ['20260718120405_add_activity_weather_samples.sql', 'e15e132930a8ad8133cc06a03e799b3f'],
  ['20260718122328_add_competitive_segments.sql', '6172c440aec5cdce8a064c8d2ee2e599'],
  ['20260718130900_add_rider_follows_and_privacy.sql', '7ceb452a2a49c25b17316e93995b2b1c'],
  ['20260718133017_add_social_notifications.sql', 'ceac0d54edf7646b69d1fd0d961acd2b'],
  ['20260718133309_harden_social_notification_triggers.sql', 'fe1f2d848cc878e9489653ac406e9b1f'],
  ['20260718133906_index_social_notifications.sql', '78e7615ea28b7e91fb9e53a3046017f2'],
  ['20260718173857_complete_rider_onboarding.sql', '56042e7aeb62a5321a670be5e671f9b3'],
  ['20260718223557_harden_data_api_grants.sql', 'ee2bb32c053857ee45de176c0b4c5afc'],
  ['20260718223650_optimize_live_session_rls.sql', 'a8fb1bd3cce144f99ffb2a231d558c4e'],
]);

function compactSqlHash(sql) {
  return createHash('md5').update(sql.replace(/\s+/g, '')).digest('hex');
}

test('the committed migration chain exactly matches production history', async () => {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  assert.deepEqual(files, [...productionMigrationHashes.keys()]);

  for (const file of files) {
    const sql = await readFile(new URL(file, migrationsDirectory), 'utf8');
    assert.equal(
      compactSqlHash(sql),
      productionMigrationHashes.get(file),
      `${file} has drifted from the migration applied to production`,
    );
  }
});

test('every Data API table enables RLS in the reproducible migration chain', async () => {
  const files = [...productionMigrationHashes.keys()];
  const migrationSql = (await Promise.all(
    files.map((file) => readFile(new URL(file, migrationsDirectory), 'utf8')),
  )).join('\n').toLowerCase();

  const exposedTables = [
    'profiles',
    'activities',
    'saved_routes',
    'activity_kudos',
    'activity_comments',
    'live_sessions',
    'maintenance_items',
    'segments',
    'segment_efforts',
    'user_follows',
    'notifications',
  ];

  for (const table of exposedTables) {
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `public.${table} must enable RLS`,
    );
  }
});

test('the final grants opt in only to operations used by the application', async () => {
  const grants = await readFile(
    new URL('20260718223557_harden_data_api_grants.sql', migrationsDirectory),
    'utf8',
  );

  assert.match(grants, /revoke all on table[\s\S]+from public, anon, authenticated;/);
  assert.match(grants, /grant select on table public\.activities to anon;/);
  assert.match(
    grants,
    /grant select, insert, update, delete on table public\.activities to authenticated;/,
  );
  assert.match(grants, /grant select on table public\.live_sessions to anon;/);
  assert.match(grants, /grant select on table public\.segments to anon, authenticated;/);
  assert.doesNotMatch(grants, /grant (?:all|insert|update|delete)[^;]+ to anon;/i);
  assert.match(
    grants,
    /alter default privileges for role postgres in schema public[\s\S]+revoke execute on functions from public, anon, authenticated;/,
  );
});
