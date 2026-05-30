import { GoogleAuth } from 'google-auth-library';

const EE_API_V1 = 'https://earthengine.googleapis.com/v1';

export interface EEMapLayer {
  tileUrlTemplate: string;
}

export async function createEESatelliteLayer(): Promise<EEMapLayer | null> {
  const projectId = process.env.EE_PROJECT_ID;

  if (!projectId) {
    console.warn('[EE] Missing EE_PROJECT_ID');
    return null;
  }

  // Try service account OAuth2
  const rawKey = process.env.EE_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    try {
      const credentials = JSON.parse(rawKey);
      const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/earthengine'] });
      const token = await auth.getAccessToken();
      if (token) return await createMapV1(projectId, token);
    } catch (err) {
      console.warn('[EE] Service account failed:', err);
    }
  }

  // Fallback: try API key with v1alpha
  const apiKey = process.env.GOOGLE_EARTH_ENGINE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://earthengine.googleapis.com/v1alpha/projects/${projectId}/image:getMapId?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: { eeImage: { image: 'COPERNICUS/S2_SR' } },
            bandIds: ['B4', 'B3', 'B2'],
            min: 0, max: 3000,
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const name = data.name as string;
        const token = data.token as string;
        return { tileUrlTemplate: `https://earthengine.googleapis.com/v1alpha/${name}/tiles/{z}/{x}/{y}?token=${token}&key=${apiKey}` };
      }
    } catch { /* ignore */ }
  }

  return null;
}

async function createMapV1(projectId: string, token: string): Promise<EEMapLayer | null> {
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
  const name = data.name as string; // "projects/{project}/maps/{uuid}"

  // Tile URL with token for browser-side fetching
  return { tileUrlTemplate: `${EE_API_V1}/${name}/tiles/{z}/{x}/{y}?access_token=${token}` };
}
