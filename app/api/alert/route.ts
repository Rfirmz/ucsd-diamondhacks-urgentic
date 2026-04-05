import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  buildVapiPhonePayload,
  startVapiPhoneCall,
  type AlertType,
  type ContactForCall,
} from "@/lib/vapi-outbound";
import { resolveReporterLocation } from "@/lib/reverse-geocode";

const MAX_CONTACTS_PER_ALERT = 8;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, contactIds, alertType, location, latitude, longitude } = body as {
      contactId?: string;
      contactIds?: string[];
      alertType?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!alertType || (alertType !== "unsafe" && alertType !== "awkward")) {
      return NextResponse.json({ error: "Invalid alertType" }, { status: 400 });
    }

    const typedAlertType = alertType as AlertType;
    const loc = await resolveReporterLocation({
      latitude,
      longitude,
      fallbackText: typeof location === "string" ? location : undefined,
    });

    const idsRaw = Array.isArray(contactIds)
      ? contactIds
      : contactId
        ? [contactId]
        : [];
    const uniqueIds = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "Provide contactId or contactIds" }, { status: 400 });
    }
    if (uniqueIds.length > MAX_CONTACTS_PER_ALERT) {
      return NextResponse.json(
        { error: `At most ${MAX_CONTACTS_PER_ALERT} contacts per alert` },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .in("id", uniqueIds);

    if (contactsError || !contacts?.length) {
      return NextResponse.json({ error: "No contacts found" }, { status: 404 });
    }

    const contactById = new Map(contacts.map((c) => [c.id, c as ContactForCall]));
    for (const id of uniqueIds) {
      if (!contactById.has(id)) {
        return NextResponse.json({ error: `Contact not found: ${id}` }, { status: 404 });
      }
    }

    const isBatch = uniqueIds.length > 1 || Array.isArray(contactIds);
    const sessionId = isBatch ? randomUUID() : null;

    const repLat =
      typeof latitude === "number" && Number.isFinite(latitude) ? latitude : null;
    const repLng =
      typeof longitude === "number" && Number.isFinite(longitude) ? longitude : null;

    const rows = uniqueIds.map((cid) => ({
      contact_id: cid,
      alert_type: typedAlertType,
      location: loc,
      status: "calling" as const,
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(repLat !== null && repLng !== null
        ? { reporter_latitude: repLat, reporter_longitude: repLng }
        : {}),
    }));

    const { data: alerts, error: alertError } = await supabase.from("alerts").insert(rows).select();

    if (alertError || !alerts?.length) {
      console.error("alert insert", alertError);
      return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }

    const apiKey = process.env.VAPI_API_KEY;
    const unsafePhoneId = process.env.VAPI_UNSAFE_PHONE_NUMBER_ID;
    const awkwardPhoneId = process.env.VAPI_AWKWARD_PHONE_NUMBER_ID;
    const unsafeAssistantId = process.env.VAPI_UNSAFE_ASSISTANT_ID;
    const awkwardAssistantId = process.env.VAPI_AWKWARD_ASSISTANT_ID;
    const appUrl = process.env.APP_URL;

    if (
      !apiKey ||
      !unsafePhoneId ||
      !awkwardPhoneId ||
      !unsafeAssistantId ||
      !awkwardAssistantId ||
      !appUrl
    ) {
      const now = new Date().toISOString();
      await supabase
        .from("alerts")
        .update({ status: "failed", updated_at: now })
        .in(
          "id",
          alerts.map((a) => a.id)
        );
      return NextResponse.json({ error: "Server missing VAPI or APP_URL configuration" }, { status: 500 });
    }

    const resolvedPhoneId = typedAlertType === "unsafe" ? unsafePhoneId : awkwardPhoneId;
    const resolvedAssistantId = typedAlertType === "unsafe" ? unsafeAssistantId : awkwardAssistantId;

    const results = await Promise.all(
      alerts.map(async (alert) => {
        const contact = contactById.get(alert.contact_id as string);
        if (!contact) {
          return { alertId: alert.id, ok: false as const, error: "Contact missing" };
        }
        const payload = buildVapiPhonePayload({
          alertId: alert.id,
          contact,
          alertType: typedAlertType,
          location: loc,
          phoneNumberId: resolvedPhoneId,
          assistantId: resolvedAssistantId,
          appUrl,
        });
        const { ok, vapiData } = await startVapiPhoneCall(apiKey, payload);
        if (!ok) {
          console.error("VAPI error", vapiData);
          await supabase
            .from("alerts")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", alert.id);
          return {
            alertId: alert.id,
            ok: false as const,
            error: vapiData.message || "VAPI call failed",
          };
        }
        const callId = vapiData.id ?? null;
        await supabase
          .from("alerts")
          .update({
            vapi_call_id: callId,
            status: "calling",
            updated_at: new Date().toISOString(),
          })
          .eq("id", alert.id);
        return { alertId: alert.id, callId, ok: true as const };
      })
    );

    const single = results[0];

    if (sessionId) {
      return NextResponse.json({
        sessionId,
        alerts: results,
        status: "calling" as const,
      });
    }

    if (!single) {
      return NextResponse.json({ error: "No alerts created" }, { status: 500 });
    }

    if (!single.ok) {
      return NextResponse.json(
        { error: "error" in single ? single.error : "VAPI call failed", alertId: single.alertId },
        { status: 502 }
      );
    }

    return NextResponse.json({
      alertId: single.alertId,
      callId: "callId" in single ? single.callId : null,
      status: "calling" as const,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
