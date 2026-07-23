import { NextRequest, NextResponse } from 'next/server';
import { getAemetAlertsForProvince } from '@/lib/aemet';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');

    if (!province) {
      return NextResponse.json({ alerts: [] });
    }

    const alerts = await getAemetAlertsForProvince(province);
    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}
