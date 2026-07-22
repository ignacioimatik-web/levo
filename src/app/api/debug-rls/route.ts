import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const results: Record<string, any> = {};

  try {
    const supabase = await createClient();

    // 1. Check auth
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    results.auth = { 
      userId: auth.user?.id, 
      email: auth.user?.email,
      error: authErr?.message 
    };

    if (!auth.user) {
      return NextResponse.json({ error: 'Not authenticated', results });
    }

    // 2. Try calling a raw SQL function via rpc
    // First, try pg_policies
    const { data: policies, error: policiesErr } = await supabase.rpc('', {});

    // 3. Try direct query
    const { data, error } = await supabase
      .from('bike_profiles')
      .select('id, profile_name', { count: 'exact', head: true });

    results.query = { error: error?.message, code: error?.code, details: error?.details, hint: error?.hint };

    // 4. Try raw SQL via execute
    // This only works with service_role key
    const { data: sqlResult, error: sqlErr } = await supabase.rpc('exec_sql', { 
      query_text: "SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'bike_profiles'" 
    }).maybeSingle();

    results.rpc = { error: sqlErr?.message, data: sqlResult };

  } catch (e: any) {
    results.catch = e?.message || String(e);
  }

  return NextResponse.json(results);
}
