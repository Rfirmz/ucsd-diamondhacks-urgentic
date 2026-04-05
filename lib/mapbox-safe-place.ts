/**
 * Mapbox Geocoding + Search Box category search for nearest public safety-related POI.
 * Docs: https://docs.mapbox.com/api/search/search-box/
 */

export type NearestSafePlace = {
  name: string;
  fullAddress: string | null;
  categoryTried: string;
  distanceMeters: number;
  /** Reporter / search origin (for map + directions). */
  originLng: number;
  originLat: number;
  destinationLng: number;
  destinationLat: number;
  /** Walking directions (Google Maps opens reliably on mobile). */
  directionsUrl: string;
};

type GeoJsonFeature = {
  type: string;
  geometry?: { type: string; coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    fullAddress?: string;
    mapbox_id?: string;
  };
};

type CategoryResponse = {
  type?: string;
  features?: GeoJsonFeature[];
};

function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function walkingDirectionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  const o = `${originLat},${originLng}`;
  const d = `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=walking`;
}

export async function mapboxForwardGeocode(
  accessToken: string,
  query: string
): Promise<{ lng: number; lat: number } | null> {
  const q = query.trim();
  if (!q || /^location unavailable$/i.test(q)) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "US");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: { center?: [number, number] }[] };
  const c = data.features?.[0]?.center;
  if (!c || c.length < 2) return null;
  return { lng: c[0], lat: c[1] };
}

/** Canonical Search Box category IDs to try (public / help). Bad IDs are skipped on empty/404. */
const SAFE_CATEGORY_IDS = [
  "police_station",
  "police",
  "hospital",
  "fire_station",
  "library",
  "town_hall",
] as const;

async function mapboxCategorySearch(
  accessToken: string,
  categoryId: string,
  proximityLng: number,
  proximityLat: number
): Promise<GeoJsonFeature[]> {
  const url = new URL(
    `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(categoryId)}`
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("proximity", `${proximityLng},${proximityLat}`);
  url.searchParams.set("limit", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "US");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as CategoryResponse;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) return [];
  return data.features.filter((f) => f.type === "Feature");
}

function featureToCandidate(
  f: GeoJsonFeature,
  categoryTried: string,
  originLng: number,
  originLat: number
): (NearestSafePlace & { mapboxId: string }) | null {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  const props = f.properties;
  const name = props?.name?.trim();
  if (!name) return null;
  const mapboxId = props?.mapbox_id ?? `${lng},${lat},${name}`;
  const addrRaw = props?.full_address ?? props?.fullAddress;
  const fullAddress =
    typeof addrRaw === "string" && addrRaw.trim() ? addrRaw.trim() : null;
  const distanceMeters = Math.round(haversineMeters(originLng, originLat, lng, lat));
  return {
    name,
    fullAddress,
    categoryTried,
    distanceMeters,
    originLng,
    originLat,
    destinationLng: lng,
    destinationLat: lat,
    directionsUrl: walkingDirectionsUrl(originLat, originLng, lat, lng),
    mapboxId,
  };
}

/**
 * Pick nearest POI across several Mapbox categories from reporter coordinates.
 */
export async function findNearestSafePlaceMapbox(
  accessToken: string,
  originLng: number,
  originLat: number
): Promise<NearestSafePlace | null> {
  const seen = new Set<string>();
  const candidates: (NearestSafePlace & { mapboxId: string })[] = [];

  for (const cat of SAFE_CATEGORY_IDS) {
    const features = await mapboxCategorySearch(accessToken, cat, originLng, originLat);
    for (const f of features) {
      const c = featureToCandidate(f, cat, originLng, originLat);
      if (!c || seen.has(c.mapboxId)) continue;
      seen.add(c.mapboxId);
      candidates.push(c);
    }
  }

  if (candidates.length === 0) {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("q", "police");
    url.searchParams.set("proximity", `${originLng},${originLat}`);
    url.searchParams.set("limit", "5");
    url.searchParams.set("types", "poi");
    url.searchParams.set("language", "en");
    url.searchParams.set("country", "US");
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as CategoryResponse;
      const features = data.features ?? [];
      for (const f of features) {
        const c = featureToCandidate(f, "forward_police", originLng, originLat);
        if (c && !seen.has(c.mapboxId)) {
          seen.add(c.mapboxId);
          candidates.push(c);
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const best = candidates[0];
  return {
    name: best.name,
    fullAddress: best.fullAddress,
    categoryTried: best.categoryTried,
    distanceMeters: best.distanceMeters,
    originLng,
    originLat,
    destinationLng: best.destinationLng,
    destinationLat: best.destinationLat,
    directionsUrl: best.directionsUrl,
  };
}

export function nearestSafePlaceToJson(p: NearestSafePlace): string {
  return JSON.stringify(p);
}

export function parseNearestSafePlaceJson(raw: string): NearestSafePlace | null {
  try {
    const o = JSON.parse(raw) as NearestSafePlace;
    if (
      typeof o.name !== "string" ||
      typeof o.destinationLng !== "number" ||
      typeof o.destinationLat !== "number" ||
      typeof o.directionsUrl !== "string"
    ) {
      return null;
    }
    const withOrigin: NearestSafePlace = {
      ...o,
      originLng: typeof o.originLng === "number" ? o.originLng : o.destinationLng,
      originLat: typeof o.originLat === "number" ? o.originLat : o.destinationLat,
    };
    return withOrigin;
  } catch {
    return null;
  }
}
