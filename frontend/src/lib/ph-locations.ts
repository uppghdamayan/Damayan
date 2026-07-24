// Dynamic Philippine Geographic Locations backed by PSGC Cloud API (https://psgc.cloud/api)
// No hardcoded data arrays; responses are cached client-side to optimize speed and avoid rate limits.

const PSGC_BASE_URL = 'https://psgc.cloud/api';

export interface PsgcItem {
  code: string;
  name: string;
  type?: string;
}

// In-memory cache for ultra-fast lookup during session
const memoryCache = new Map<string, PsgcItem[]>();

async function fetchList(path: string): Promise<PsgcItem[]> {
  if (memoryCache.has(path)) {
    return memoryCache.get(path)!;
  }

  // Session storage caching if available in browser
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cached = sessionStorage.getItem(`psgc_${path}`);
      if (cached) {
        const parsed: PsgcItem[] = JSON.parse(cached);
        memoryCache.set(path, parsed);
        return parsed;
      }
    } catch {
      // Ignore storage errors
    }
  }

  const res = await fetch(`${PSGC_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`PSGC API Error (${res.status}): Failed to fetch ${path}`);
  }

  const json = await res.json();
  const list: PsgcItem[] = Array.isArray(json) ? json : json.data ?? [];

  memoryCache.set(path, list);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(`psgc_${path}`, JSON.stringify(list));
    } catch {
      // Ignore storage errors
    }
  }

  return list;
}

/**
 * Fetch all Philippine Regions from PSGC Cloud API.
 */
export async function fetchPsgcRegions(): Promise<PsgcItem[]> {
  return fetchList('/regions');
}

/**
 * Fetch Provinces for a given Region code.
 * Note: Metro Manila (NCR) returns an empty array as it has no provinces.
 */
export async function fetchPsgcProvinces(regionCode: string): Promise<PsgcItem[]> {
  if (!regionCode) return [];
  try {
    return await fetchList(`/regions/${regionCode}/provinces`);
  } catch {
    return [];
  }
}

/**
 * Fetch Cities / Municipalities for a given Region and optional Province code.
 */
export async function fetchPsgcCities(
  regionCode: string,
  provinceCode?: string
): Promise<PsgcItem[]> {
  if (provinceCode) {
    return fetchList(`/provinces/${provinceCode}/cities-municipalities`);
  }
  if (regionCode) {
    return fetchList(`/regions/${regionCode}/cities-municipalities`);
  }
  return [];
}

/**
 * Fetch Barangays for a given City/Municipality/Sub-Municipality code.
 */
export async function fetchPsgcBarangays(
  cityCode: string,
  cityType?: string
): Promise<PsgcItem[]> {
  if (!cityCode) return [];

  let primaryPath = `/cities-municipalities/${cityCode}/barangays`;
  if (cityType === 'SubMun') {
    primaryPath = `/sub-municipalities/${cityCode}/barangays`;
  } else if (cityType === 'City') {
    primaryPath = `/cities/${cityCode}/barangays`;
  } else if (cityType === 'Mun') {
    primaryPath = `/municipalities/${cityCode}/barangays`;
  }

  try {
    const list = await fetchList(primaryPath);
    if (list.length > 0) return list;
  } catch {
    // Fallthrough to alternative path
  }

  try {
    return await fetchList(`/cities-municipalities/${cityCode}/barangays`);
  } catch {
    return [];
  }
}
