const NOMINATIM_ORIGIN = 'https://nominatim.openstreetmap.org';
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const responseCache = new Map<string, { expiresAt: number; payload: unknown }>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

export class GeocodingInputError extends Error {}

export function buildSearchUrl(query: string) {
  const normalized = query.trim();
  if (normalized.length < 3 || normalized.length > 200) {
    throw new GeocodingInputError('Từ khóa địa chỉ phải có từ 3 đến 200 ký tự.');
  }
  const parameters = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'vn',
    'accept-language': 'vi',
    q: normalized,
  });
  return `${NOMINATIM_ORIGIN}/search?${parameters}`;
}

export function buildReverseUrl(latitudeInput: string, longitudeInput: string) {
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new GeocodingInputError('Vĩ độ không hợp lệ.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new GeocodingInputError('Kinh độ không hợp lệ.');
  }
  const parameters = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'vi',
    lat: String(latitude),
    lon: String(longitude),
  });
  return `${NOMINATIM_ORIGIN}/reverse?${parameters}`;
}

export async function requestNominatim<T>(url: string): Promise<T> {
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload as T;

  let releaseQueue: () => void = () => undefined;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
  await previous;
  try {
    const cachedAfterWait = responseCache.get(url);
    if (cachedAfterWait && cachedAfterWait.expiresAt > Date.now()) return cachedAfterWait.payload as T;
    const waitTime = Math.max(0, nextRequestAt - Date.now());
    if (waitTime) await new Promise((resolve) => setTimeout(resolve, waitTime));
    nextRequestAt = Date.now() + 1_000;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'vi',
        'User-Agent': process.env.GEOCODING_USER_AGENT ?? 'InternMarket/0.1 (local-development)',
      },
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const payload = await response.json() as T;
    responseCache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return payload;
  } finally {
    releaseQueue();
  }
}
