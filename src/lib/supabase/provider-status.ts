export interface AuthProviderAvailability {
  email: boolean;
  google: boolean;
  apple: boolean;
}

export function normalizeProviderAvailability(input: unknown): AuthProviderAvailability {
  const external = input && typeof input === 'object' && 'external' in input
    ? (input as { external?: unknown }).external
    : null;
  const values = external && typeof external === 'object'
    ? external as Record<string, unknown>
    : {};
  return {
    email: values.email === true,
    google: values.google === true,
    apple: values.apple === true,
  };
}

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return normalizeProviderAvailability(await response.json());
  } catch {
    return null;
  }
}
