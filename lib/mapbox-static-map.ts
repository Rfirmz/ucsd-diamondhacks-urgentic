import type { NearestSafePlace } from "@/lib/mapbox-safe-place";

const STYLE = "mapbox/streets-v12";
const W = 600;
const H = 288;

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Mapbox Static Images API — geojson overlay + auto viewport.
 * Token needs styles:tiles scope (see Mapbox Static Images docs).
 */
export function buildNearestPlaceStaticImageUrl(
  accessToken: string,
  place: NearestSafePlace
): string {
  const { destinationLng, destinationLat, originLng, originLat } = place;
  if (!finite(destinationLng) || !finite(destinationLat)) {
    throw new Error("Invalid destination");
  }

  type GjFeature = {
    type: "Feature";
    properties: Record<string, string>;
    geometry: { type: "Point"; coordinates: [number, number] };
  };

  const features: GjFeature[] = [];

  const sameAsDest =
    finite(originLng) &&
    finite(originLat) &&
    Math.abs(originLng - destinationLng) < 1e-7 &&
    Math.abs(originLat - destinationLat) < 1e-7;

  if (finite(originLng) && finite(originLat) && !sameAsDest) {
    features.push({
      type: "Feature",
      properties: {
        "marker-color": "#34d399",
        "marker-size": "small",
      },
      geometry: { type: "Point", coordinates: [originLng, originLat] },
    });
  }

  features.push({
    type: "Feature",
    properties: {
      "marker-color": "#22d3ee",
      "marker-size": "small",
    },
    geometry: { type: "Point", coordinates: [destinationLng, destinationLat] },
  });

  const fc = { type: "FeatureCollection" as const, features };
  const encoded = encodeURIComponent(JSON.stringify(fc));
  const path = `geojson(${encoded})/auto/${W}x${H}@2x`;

  const url = new URL(`https://api.mapbox.com/styles/v1/${STYLE}/static/${path}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("padding", "56");
  url.searchParams.set("attribution", "true");
  url.searchParams.set("logo", "true");
  return url.toString();
}
