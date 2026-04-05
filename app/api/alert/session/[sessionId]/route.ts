import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { getNextSteps } from "@/lib/next-steps";

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
  contacts: {
    contact_name: string;
    contact_phone: string;
  } | null;
};

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  if (!sessionId) {
    return noStoreJson({ error: "Missing session id" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, status, alert_type, location, contact_response, contact_location, created_at, contacts (contact_name, contact_phone)"
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

  return noStoreJson({
    sessionId,
    alertType: first.alert_type,
    location: first.location,
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
