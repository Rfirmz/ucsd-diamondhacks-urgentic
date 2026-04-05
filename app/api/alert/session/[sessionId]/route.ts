import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { getNextSteps } from "@/lib/next-steps";
import {
  findNearestSafePlaceMapbox,
  mapboxForwardGeocode,
  nearestSafePlaceToJson,
  parseNearestSafePlaceJson,
  type NearestSafePlace,
} from "@/lib/mapbox-safe-place";
import {
  guidanceToJson,
  openAiSessionGuidance,
  parseSessionGuidanceJson,
  ruleBasedSessionGuidance,
  type ContactOutcome,
  type SessionGuidance,
} from "@/lib/session-ai-summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreJson = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
    },
  });

type Row = {
  id: string;
  status: string;
  alert_type: string;
  location: string | null;
  contact_response: string | null;
  contact_location: string | null;
  created_at: string;
  session_ai_summary: string | null;
  reporter_latitude: number | null;
  reporter_longitude: number | null;
  session_nearest_place_json: string | null;
  contacts: {
    contact_name: string;
    contact_phone: string;
  } | null;
};

function buildContactOutcomes(rows: Row[]): ContactOutcome[] {
  return rows.map((row) => ({
    name: row.contacts?.contact_name ?? "Contact",
    status: row.status,
    response: row.contact_response,
    theirLocation: row.contact_location,
  }));
}

function allAlertsTerminal(rows: Row[]): boolean {
  return rows.length > 0 && rows.every((r) => r.status === "responded" || r.status === "failed");
}

async function ensureSessionGuidance(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rows: Row[]
): Promise<SessionGuidance | null> {
  if (!allAlertsTerminal(rows)) return null;

  const first = rows[0];
  const cachedRaw = rows.find((r) => r.session_ai_summary?.trim())?.session_ai_summary;
  if (cachedRaw) {
    const parsed = parseSessionGuidanceJson(cachedRaw);
    if (parsed) return parsed;
  }

  const outcomes = buildContactOutcomes(rows);
  const guidance =
    (await openAiSessionGuidance({
      alertType: first.alert_type,
      reporterLocation: first.location,
      contacts: outcomes,
    })) ?? ruleBasedSessionGuidance(first.alert_type, first.location, outcomes);

  const json = guidanceToJson(guidance);
  const ids = rows.map((r) => r.id);
  const { error } = await supabase.from("alerts").update({ session_ai_summary: json }).in("id", ids);

  if (error) {
    console.error("session_ai_summary save", error);
  }

  return guidance;
}

async function resolveReporterCoords(
  mapboxToken: string,
  row: Row
): Promise<{ lng: number; lat: number } | null> {
  const lat = row.reporter_latitude;
  const lng = row.reporter_longitude;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lng, lat };
  }
  const loc = row.location?.trim();
  if (!loc || /^location unavailable$/i.test(loc)) return null;
  return mapboxForwardGeocode(mapboxToken, loc);
}

async function ensureNearestSafePlace(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rows: Row[]
): Promise<NearestSafePlace | null> {
  if (!allAlertsTerminal(rows)) return null;

  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!mapboxToken) return null;

  const cachedRaw = rows.find((r) => r.session_nearest_place_json?.trim())?.session_nearest_place_json;
  if (cachedRaw) {
    const parsed = parseNearestSafePlaceJson(cachedRaw);
    if (parsed) return parsed;
  }

  const first = rows[0];
  const coords = await resolveReporterCoords(mapboxToken, first);
  if (!coords) return null;

  try {
    const place = await findNearestSafePlaceMapbox(mapboxToken, coords.lng, coords.lat);
    if (!place) return null;

    const json = nearestSafePlaceToJson(place);
    const ids = rows.map((r) => r.id);
    const { error } = await supabase.from("alerts").update({ session_nearest_place_json: json }).in("id", ids);
    if (error) console.error("session_nearest_place save", error);

    return place;
  } catch (e) {
    console.error("mapbox nearest place", e);
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  if (!sessionId) {
    return noStoreJson({ error: "Missing session id" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, status, alert_type, location, contact_response, contact_location, created_at, session_ai_summary, reporter_latitude, reporter_longitude, session_nearest_place_json, contacts (contact_name, contact_phone)"
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("session alerts", error);
    return noStoreJson({ error: "Failed to load session" }, 500);
  }

  if (!data?.length) {
    return noStoreJson({ error: "Session not found" }, 404);
  }

  const rows = data as unknown as Row[];
  const first = rows[0];

  let aiGuidance: SessionGuidance | null = null;
  try {
    aiGuidance = await ensureSessionGuidance(supabase, rows);
  } catch (e) {
    console.error("session guidance", e);
    if (allAlertsTerminal(rows)) {
      aiGuidance = ruleBasedSessionGuidance(
        first.alert_type,
        first.location,
        buildContactOutcomes(rows)
      );
    }
  }

  let nearestSafePlace: NearestSafePlace | null = null;
  try {
    nearestSafePlace = await ensureNearestSafePlace(supabase, rows);
  } catch (e) {
    console.error("nearest safe place", e);
  }

  return noStoreJson({
    sessionId,
    alertType: first.alert_type,
    location: first.location,
    aiGuidance,
    nearestSafePlace,
    alerts: rows.map((row) => {
      const contactName = row.contacts?.contact_name ?? "Contact";
      return {
        id: row.id,
        status: row.status,
        contactName,
        contactPhone: row.contacts?.contact_phone ?? null,
        contactResponse: row.contact_response,
        contactLocation: row.contact_location,
        nextSteps: getNextSteps(contactName, row.alert_type, row.contact_response),
        createdAt: row.created_at,
      };
    }),
  });
}
