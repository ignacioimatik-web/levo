const EE_API_BASE = 'https://earthengine.googleapis.com/v1alpha';

export interface EEMapLayer {
  tileUrlTemplate: string;
}

export async function createEESatelliteLayer(): Promise<EEMapLayer | null> {
  const apiKey = process.env.GOOGLE_EARTH_ENGINE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_EARTH_ENGINE_API_KEY;
  const projectId = process.env.EE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn('[EE] Missing API key or project ID');
    return null;
  }

  try {
    const res = await fetch(
      `${EE_API_BASE}/projects/${projectId}/image:getMapId?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { eeImage: { image: 'COPERNICUS/S2_SR' } },
          bandIds: ['B4', 'B3', 'B2'],
          min: 0,
          max: 3000,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[EE] getMapId error (${res.status}): ${text}`);
      return null;
    }

    const data = await res.json();

    // data.mapId is a full path like "projects/{project}/maps/{uuid}"
    // data.token is the auth token
    const mapPath = data.name as string; // full resource name
    const token = data.token as string;

    const tileUrlTemplate = `${EE_API_BASE}/${mapPath}/tiles/{z}/{x}/{y}?token=${token}&key=${apiKey}`;

    return { tileUrlTemplate };
  } catch (err) {
    console.warn('[EE] createEESatelliteLayer error:', err);
    return null;
  }
}
