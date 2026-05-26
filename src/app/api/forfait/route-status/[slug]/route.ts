import { NextRequest, NextResponse } from 'next/server';
import { buildRouteStatus } from '@/lib/route-status';

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tz = req.nextUrl.searchParams.get('tz') ?? 'Europe/Madrid';
  const payload = await buildRouteStatus(slug, tz);
  return NextResponse.json(payload, { status: payload.ok ? 200 : 404 });
}
