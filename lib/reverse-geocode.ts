/**
 * Reverse geocode via OpenStreetMap Nominatim (free, no API key).
 * Policy: https://operations.osmfoundation.org/policies/nominatim/ — use sparingly; we call once per alert batch.
 */

const UA =
  process.env.NOMINATIM_USER_AGENT?.trim() ||
  "Urgentic/1.0 (campus safety demo; contact via repo maintainer)";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  region?: string;
};

type NominatimJson = {
  display_name?: string;
  address?: NominatimAddress;
};

function formatFromAddress(data: NominatimJson): string | null {
  const a = data.address;
  if (!a) {
    const d = data.display_name?.trim();
    return d ? d.split(",").slice(0, 4).join(",").trim() : null;
  }
  const parts: string[] = [];
  const line1 = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  if (line1) parts.push(line1);
  const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
  if (area && !line1.includes(area)) parts.push(area);
  const city = a.city || a.town || a.village || a.hamlet;
  if (city) parts.push(city);
  const state = a.state || a.region;
  if (state && !parts.some((p) => p.includes(state))) parts.push(state);
  if (parts.length === 0) {
    const d = data.display_name?.trim();
    return d ? d.split(",").slice(0, 3).join(",").trim() : null;
  }
  const s = parts.join(", ");
  return s.length > 180 ? `${s.slice(0, 177)}…` : s;
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimJson;
    return formatFromAddress(data);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function coordFallback(lat: number, lng: number): string {
  return `near ${lat.toFixed(4)}, ${lng.toFixed(4)} — open maps with those coordinates if needed`;
}

/**
 * Human-readable string for TTS and DB `alerts.location`.
 */
export async function resolveReporterLocation(params: {
  latitude?: unknown;
  longitude?: unknown;
  fallbackText?: unknown;
}): Promise<string> {
  const lat = typeof params.latitude === "number" ? params.latitude : Number(params.latitude);
  const lng = typeof params.longitude === "number" ? params.longitude : Number(params.longitude);
  const text =
    typeof params.fallbackText === "string" && params.fallbackText.trim()
      ? params.fallbackText.trim()
      : "";

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    const place = await reverseGeocodeLatLng(lat, lng);
    if (place) return place;
    return coordFallback(lat, lng);
  }

  if (text) return text;
  return "Location unavailable";
}
