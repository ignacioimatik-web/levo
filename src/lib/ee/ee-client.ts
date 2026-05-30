import { GoogleAuth } from 'google-auth-library';

const EE_API_V1 = 'https://earthengine.googleapis.com/v1';

export interface EEMapLayer {
  tileUrlTemplate: string;
}

export async function createEESatelliteLayer(): Promise<EEMapLayer | null> {
  const projectId = process.env.EE_PROJECT_ID;
  const saKey = process.env.EE_SERVICE_ACCOUNT_KEY;

  if (!projectId || !saKey) {
    console.warn('[EE] Missing EE_PROJECT_ID or EE_SERVICE_ACCOUNT_KEY');
    return null;
  }

  try {
    const credentials = JSON.parse(saKey);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/earthengine'],
    });
    const token = await auth.getAccessToken();
    if (!token) {
      console.warn('[EE] No access token');
      return null;
    }

    const res = await fetch(`${EE_API_V1}/projects/${projectId}/maps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        expression: `ee.ImageCollection("COPERNICUS/S2_SR")
.filterDate("2025-01-01","2026-12-31")
.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE",20))
.median()
.visualize({min:0,max:3000,bands:["B4","B3","B2"]})`,
        fileFormat: 'png',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[EE] maps:create error (${res.status}): ${text}`);
      return null;
    }

    const data = await res.json();
    const mapName = data.name as string;
    return { tileUrlTemplate: `${EE_API_V1}/${mapName}/tiles/{z}/{x}/{y}` };
  } catch (err) {
    console.warn('[EE] Error:', err);
    return null;
  }
}
