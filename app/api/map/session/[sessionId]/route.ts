import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { parseNearestSafePlaceJson } from "@/lib/mapbox-safe-place";
import { buildNearestPlaceStaticImageUrl } from "@/lib/mapbox-static-map";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  const sessionId = params.sessionId?.trim();
  if (!sessionId) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    return new NextResponse("Map unavailable", { status: 503 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("session_nearest_place_json")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.session_nearest_place_json?.trim()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const place = parseNearestSafePlaceJson(data.session_nearest_place_json);
  if (!place) {
    return new NextResponse("Not found", { status: 404 });
  }

  let imageUrl: string;
  try {
    imageUrl = buildNearestPlaceStaticImageUrl(token, place);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const mapRes = await fetch(imageUrl, { cache: "no-store" });
  if (!mapRes.ok) {
    const detail = await mapRes.text().catch(() => "");
    console.error("mapbox static image", mapRes.status, detail.slice(0, 200));
    return new NextResponse("Map failed", { status: 502 });
  }

  const buf = await mapRes.arrayBuffer();
  const contentType = mapRes.headers.get("content-type") || "image/png";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
