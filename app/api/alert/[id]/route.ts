import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { getNextSteps } from "@/lib/next-steps";

/** Avoid Next.js caching Supabase REST fetches and CDN/browser caching this JSON. */
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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) {
    return noStoreJson({ error: "Missing id" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, status, alert_type, location, contact_response, contact_location, created_at, contacts (contact_name, contact_phone)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return noStoreJson({ error: "Alert not found" }, 404);
  }

  const row = data as unknown as Row;
  const contactName = row.contacts?.contact_name ?? "your contact";
  const nextSteps = getNextSteps(contactName, row.alert_type, row.contact_response);

  return noStoreJson({
    id: row.id,
    status: row.status,
    alertType: row.alert_type,
    location: row.location,
    contactResponse: row.contact_response,
    contactLocation: row.contact_location,
    contactName,
    contactPhone: row.contacts?.contact_phone ?? null,
    nextSteps,
    createdAt: row.created_at,
  });
}
