import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";

const TRANSCRIPT_MAX = 12000;

type ToolCallEntry = {
  id?: string;
  name?: string;
  parameters?: Record<string, unknown>;
  arguments?: string | Record<string, unknown>;
  function?: { name?: string; arguments?: string };
};

type ArtifactMsg = { role?: string; message?: string; content?: string };

type StructuredOutputEntry = {
  name?: string;
  result?: unknown;
};

type ArtifactPayload = {
  transcript?: string;
  messages?: ArtifactMsg[];
  structuredOutputs?: Record<string, StructuredOutputEntry>;
  structured_outputs?: Record<string, StructuredOutputEntry>;
};

type WebhookMessage = {
  type?: string;
  endedReason?: string;
  /** Vapi may include voicemail / success flags here on end-of-call-report. */
  analysis?: Record<string, unknown>;
  call?: {
    id?: string;
    metadata?: Record<string, unknown>;
    /** Twilio-style AMD, or Vapi transport hints. */
    answeredBy?: string;
  };
  artifact?: ArtifactPayload;
  toolCallList?: ToolCallEntry[];
  toolWithToolCallList?: {
    name?: string;
    toolCall?: { id?: string; parameters?: Record<string, unknown> };
  }[];
};

function getStructuredOutputsMap(artifact: ArtifactPayload | undefined): Record<string, StructuredOutputEntry> | undefined {
  if (!artifact) return undefined;
  const o = artifact.structuredOutputs ?? artifact.structured_outputs;
  if (o && typeof o === "object" && !Array.isArray(o)) return o;
  return undefined;
}

function stringifyStructuredPrimitive(r: unknown): string | null {
  if (r === null || r === undefined) return null;
  if (typeof r === "string") return r.trim() || null;
  if (typeof r === "boolean" || typeof r === "number") return String(r);
  return null;
}

/**
 * Vapi returns one map entry per structured output: `{ name: "location", result: "courts" }` and
 * `{ name: "response_choice_awk", result: "..." }`, not a single object with both keys in `result`.
 * Still supports legacy `result` as `{ location, response_choice_awk | response_choice_unsafe }`.
 */
function extractStructuredFields(
  structuredMap: Record<string, StructuredOutputEntry> | undefined,
  alertType: "unsafe" | "awkward"
): { location: string | null; choice: string | null } {
  if (!structuredMap) return { location: null, choice: null };

  let location: string | null = null;
  let choice: string | null = null;

  for (const entry of Object.values(structuredMap)) {
    const r = entry?.result;
    if (r === null || r === undefined) continue;

    const outputName = typeof entry?.name === "string" ? entry.name.trim() : "";
    const nameLower = outputName.toLowerCase();

    if (nameLower === "location") {
      const s = stringifyStructuredPrimitive(r);
      if (s && !location) location = s;
      continue;
    }

    if (alertType === "awkward") {
      if (nameLower === "response_choice_awk" || outputName === "response_choice_awk") {
        const s = stringifyStructuredPrimitive(r);
        if (s && !choice) choice = s;
        continue;
      }
    } else if (nameLower === "response_choice_unsafe" || outputName === "response_choice_unsafe") {
      const s = stringifyStructuredPrimitive(r);
      if (s && !choice) choice = s;
      continue;
    }

    let o: Record<string, unknown> | null = null;
    if (typeof r === "string") {
      try {
        const parsed = JSON.parse(r) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          o = parsed as Record<string, unknown>;
        }
      } catch {
        /* plain string handled via entry.name branches */
      }
    } else if (typeof r === "object" && !Array.isArray(r)) {
      o = r as Record<string, unknown>;
    }
    if (!o) continue;

    const locRaw = o.location ?? o.Location;
    if (typeof locRaw === "string" && locRaw.trim() && !location) {
      location = locRaw.trim();
    }

    if (alertType === "awkward") {
      const v = o.response_choice_awk ?? o.responseChoiceAwk;
      if (typeof v === "string" && v.trim() && !choice) choice = v.trim();
    } else {
      const v = o.response_choice_unsafe ?? o.responseChoiceUnsafe;
      if (typeof v === "string" && v.trim() && !choice) choice = v.trim();
    }
  }

  return { location, choice };
}

function buildTranscriptFromArtifact(artifact: ArtifactPayload | undefined): string {
  if (!artifact) return "";
  if (typeof artifact.transcript === "string" && artifact.transcript.trim()) {
    return artifact.transcript.trim();
  }
  if (Array.isArray(artifact.messages) && artifact.messages.length > 0) {
    return artifact.messages
      .map((m) => {
        const text = (m.message ?? m.content ?? "").trim();
        if (!text) return "";
        return `${(m.role ?? "unknown").toLowerCase()}: ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Vapi `endedReason` when the callee never really engaged (hang up, no pickup, etc.). */
function callEndedWithoutUsefulHuman(endedReason: string): boolean {
  const r = endedReason.trim().toLowerCase();
  if (!r) return false;
  // Avoid bare `hang` — it matches inside unrelated words like "change".
  return /customer-did-not-answer|no-answer|no_answer|voicemail|busy|\bfailed\b|timeout|silence|hangup|hang-up|hung-up|hung\s+up|disconnec|customer-ended|user-ended|ended-by-user|declin|unreachable|no\.?\s*route|\bsip\b|\bcancel\b|abandon|rejected|not.picked|machine|fax|max-duration|exceeded-max|call\.rejected/i.test(
    r
  );
}

/**
 * Voicemail / answering-machine: never treat structured outputs as a live human response.
 * Uses endedReason, optional analysis flags, and call.answeredBy when present.
 */
function isVoicemailOrAnsweringMachine(message: WebhookMessage, endedReason: string): boolean {
  const r = endedReason.trim().toLowerCase();
  if (r) {
    if (
      /\bvoicemail\b|voice-mail|voice_mail|answering[-_\s]?machine|sip voicemail|amd|machine\s*detect|detected[-_\s]?machine|beep[-_\s]?detect/i.test(
        r
      )
    ) {
      return true;
    }
  }

  const a = message.analysis;
  if (a && typeof a === "object") {
    const flags = [
      a.voicemailDetected,
      a.voicemail_detected,
      a.isVoicemail,
      a.is_voicemail,
      a.reachedVoicemail,
      a.reached_voicemail,
    ];
    if (flags.some((v) => v === true)) return true;

    const ab = a.answeredBy ?? a.answered_by;
    if (typeof ab === "string" && /machine|voicemail|fax|modem/i.test(ab)) return true;
  }

  const answeredBy = message.call?.answeredBy;
  if (typeof answeredBy === "string" && /machine|voicemail|fax/i.test(answeredBy)) return true;

  return false;
}

/**
 * True if artifact looks like the human on the phone said something (not just the assistant monologue).
 * Without this, structured outputs can echo a menu option even when nobody answered.
 */
function hasApparentUserSpeech(artifact: ArtifactPayload | undefined, rawTranscript: string): boolean {
  if (artifact?.messages && artifact.messages.length > 0) {
    const userRole = /^(user|customer|caller|human|member|contact|participant)$/i;
    for (const m of artifact.messages) {
      const role = (m.role ?? "").trim();
      const text = (m.message ?? m.content ?? "").trim();
      if (text.length >= 2 && userRole.test(role)) return true;
    }
    return false;
  }
  const flat =
    (typeof artifact?.transcript === "string" && artifact.transcript.trim()) || rawTranscript.trim();
  if (!flat) return false;
  if (/\b(user|customer|caller)\s*:/i.test(flat)) return true;
  const onlyAssistant =
    /\b(assistant|bot|system)\s*:/i.test(flat) && !/\b(user|customer|caller)\s*:/i.test(flat);
  if (onlyAssistant) return false;
  return flat.length >= 40;
}

function resolveAlertId(message: WebhookMessage): string | undefined {
  const m = message.call?.metadata;
  if (!m) return undefined;
  const id = m.alertId ?? m.alert_id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return undefined;
}

function resolveAlertType(meta: Record<string, unknown> | undefined): "unsafe" | "awkward" | null {
  if (!meta) return null;
  const t = meta.alertType ?? meta.alert_type;
  if (t === "unsafe" || t === "awkward") return t;
  return null;
}

function pickLocation(o: Record<string, unknown>): string | undefined {
  if (typeof o.contact_location === "string") return o.contact_location;
  if (typeof o.contactLocation === "string") return o.contactLocation;
  return undefined;
}

function parseArgs(tc: ToolCallEntry): { response?: string; contact_location?: string } {
  const raw = tc.parameters ?? tc.arguments;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const response = typeof o.response === "string" ? o.response : undefined;
    return { response, contact_location: pickLocation(o) };
  }
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return {
        response: typeof o.response === "string" ? o.response : undefined,
        contact_location: pickLocation(o),
      };
    } catch {
      return {};
    }
  }
  return {};
}

async function handleEndOfCallReport(message: WebhookMessage) {
  const alertId = resolveAlertId(message);
  if (!alertId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceRoleClient();

  let alertType = resolveAlertType(message.call?.metadata);
  if (!alertType) {
    const { data: row } = await supabase.from("alerts").select("alert_type").eq("id", alertId).single();
    alertType = row?.alert_type === "unsafe" ? "unsafe" : "awkward";
  }

  const structuredMap = getStructuredOutputsMap(message.artifact);
  const { location: structuredLocation, choice } = extractStructuredFields(structuredMap, alertType);

  const endedReason = typeof message.endedReason === "string" ? message.endedReason : "";
  const badEnd = callEndedWithoutUsefulHuman(endedReason);

  const rawTranscript = buildTranscriptFromArtifact(message.artifact);
  const userSpoke = hasApparentUserSpeech(message.artifact, rawTranscript);
  /** If the call didn't obviously fail and there's enough dialog, trust structured choice even without role tags. */
  const substantiveDialog = rawTranscript.trim().length >= 22;

  let contact_response: string;
  let contact_location: string | null = structuredLocation;
  let status: "responded" | "failed";

  const noResponseCopy = "No response";

  /** Trust Vapi structured choice when there's dialog proof OR the endedReason isn't a hard failure. */
  const acceptChoice =
    Boolean(choice) && (userSpoke || substantiveDialog || !badEnd);

  const { data: existing } = await supabase
    .from("alerts")
    .select("status, contact_response")
    .eq("id", alertId)
    .single();

  if (acceptChoice) {
    contact_response = choice as string;
    status = "responded";
  } else if (badEnd && !userSpoke) {
    contact_response = noResponseCopy;
    status = "failed";
  } else if (choice) {
    contact_response = noResponseCopy;
    status = "failed";
  } else if (rawTranscript && userSpoke) {
    let text = rawTranscript;
    if (text.length > TRANSCRIPT_MAX) {
      text = `${text.slice(0, TRANSCRIPT_MAX)}\n…(truncated)`;
    }
    contact_response = text;
    status = "responded";
  } else if (rawTranscript) {
    contact_response = noResponseCopy;
    status = "failed";
  } else if (badEnd) {
    contact_response = noResponseCopy;
    status = "failed";
  } else {
    contact_response = noResponseCopy;
    status = "failed";
  }

  if (isVoicemailOrAnsweringMachine(message, endedReason)) {
    contact_response = noResponseCopy;
    status = "failed";
    contact_location = null;
  }

  if (status === "failed" && contact_response === noResponseCopy) {
    contact_location = null;
  }

  const alreadyGood =
    existing?.status === "responded" &&
    typeof existing.contact_response === "string" &&
    existing.contact_response.trim() !== "" &&
    existing.contact_response !== noResponseCopy;

  if (alreadyGood && status === "failed" && !isVoicemailOrAnsweringMachine(message, endedReason)) {
    return NextResponse.json({ ok: true });
  }

  const { error: reportErr } = await supabase
    .from("alerts")
    .update({
      status,
      contact_response,
      contact_location,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (reportErr) {
    console.error("vapi-webhook end-of-call-report save", reportErr);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleToolCalls(message: WebhookMessage) {
  const results: { toolCallId: string; result: string }[] = [];
  const alertId = resolveAlertId(message);
  if (!alertId) {
    return NextResponse.json({ results });
  }

  const list: ToolCallEntry[] = [];

  if (Array.isArray(message.toolCallList)) {
    for (const tc of message.toolCallList) {
      const fnArgs = tc.function?.arguments;
      list.push({
        id: tc.id,
        name: tc.name ?? tc.function?.name,
        parameters: tc.parameters as Record<string, unknown> | undefined,
        arguments: (fnArgs ?? tc.arguments) as string | Record<string, unknown> | undefined,
      });
    }
  }

  if (Array.isArray(message.toolWithToolCallList)) {
    for (const item of message.toolWithToolCallList) {
      const tc = item.toolCall;
      if (tc?.id) {
        list.push({
          id: tc.id,
          name: item.name,
          parameters: tc.parameters,
        });
      }
    }
  }

  const supabase = createServiceRoleClient();

  for (const tc of list) {
    const name = tc.name ?? "";
    if (name !== "send_response") continue;

    const toolCallId = tc.id ?? "unknown";
    const { response, contact_location } = parseArgs(tc);
    let updated = false;

    if (typeof response === "string" && response.trim() && typeof contact_location === "string") {
      const { error: saveErr } = await supabase
        .from("alerts")
        .update({
          status: "responded",
          contact_response: response.trim(),
          contact_location: contact_location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alertId);
      if (!saveErr) {
        updated = true;
      } else {
        console.error("vapi-webhook send_response save", saveErr);
      }
    }

    results.push({
      toolCallId,
      result: updated ? "Response recorded successfully." : "Missing response fields.",
    });
  }

  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: WebhookMessage };
    const message = body.message;
    if (!message?.type) {
      return NextResponse.json({ ok: true });
    }

    if (message.type === "end-of-call-report") {
      return handleEndOfCallReport(message);
    }

    if (message.type === "tool-calls") {
      return handleToolCalls(message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vapi-webhook", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
