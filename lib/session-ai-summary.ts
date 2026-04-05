export type SessionGuidance = {
  title: string;
  bullets: string[];
};

export type ContactOutcome = {
  name: string;
  status: string;
  response: string | null;
  theirLocation: string | null;
};

export function parseSessionGuidanceJson(raw: string): SessionGuidance | null {
  try {
    const o = JSON.parse(raw) as { title?: unknown; bullets?: unknown };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const bullets = Array.isArray(o.bullets)
      ? o.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
      : [];
    if (!title || bullets.length === 0) return null;
    return { title: title.slice(0, 200), bullets: bullets.slice(0, 6).map((b) => b.slice(0, 400)) };
  } catch {
    return null;
  }
}

export function guidanceToJson(g: SessionGuidance): string {
  return JSON.stringify({ title: g.title, bullets: g.bullets });
}

/** Deterministic fallback when OpenAI is unavailable. */
export function ruleBasedSessionGuidance(
  alertType: string,
  reporterLocation: string | null,
  contacts: ContactOutcome[]
): SessionGuidance {
  const answered = contacts.filter((c) => c.status === "responded");
  const failed = contacts.filter((c) => c.status === "failed");
  const loc =
    reporterLocation && !/^location unavailable$/i.test(reporterLocation.trim())
      ? reporterLocation.trim()
      : null;

  const bullets: string[] = [];
  if (loc) bullets.push(`Your shared place: ${loc}.`);

  if (answered.length === contacts.length && contacts.length > 0) {
    bullets.push(
      ...answered.map((c) => {
        const r = c.response?.trim() || "(confirmed)";
        const where = c.theirLocation?.trim();
        return where ? `${c.name}: ${r} — they said they’re near: ${where}.` : `${c.name}: ${r}.`;
      })
    );
    bullets.push("Coordinate with whoever is coming; tell others if plans change.");
    return {
      title: "Everyone responded",
      bullets: bullets.slice(0, 6),
    };
  }

  if (answered.length === 0 && failed.length === contacts.length && contacts.length > 0) {
    const title = alertType === "unsafe" ? "No one confirmed on the call" : "No one picked up";
    const extra =
      alertType === "unsafe"
        ? [
            "If you still feel unsafe, call 911 or campus emergency.",
            "Move toward a public, well-lit area if you can.",
            "Try texting a trusted contact or calling again in a minute.",
          ]
        : [
            "Try texting someone from your list or stepping to a safer spot.",
            "You can start another alert from the home screen when ready.",
          ];
    return { title, bullets: [...bullets, ...extra].slice(0, 6) };
  }

  if (answered.length > 0 && failed.length > 0) {
    bullets.push(
      ...answered.map((c) => {
        const r = c.response?.trim() || "responded";
        return `${c.name} answered: ${r}.`;
      })
    );
    bullets.push(`No answer from: ${failed.map((f) => f.name).join(", ")}.`);
    bullets.push("Prioritize the people who confirmed; try the others by text or call.");
    return {
      title: "Mixed results",
      bullets: bullets.slice(0, 6),
    };
  }

  return {
    title: "Status",
    bullets:
      bullets.length > 0
        ? bullets
        : ["Review each contact below for details."],
  };
}

export async function openAiSessionGuidance(params: {
  alertType: string;
  reporterLocation: string | null;
  contacts: ContactOutcome[];
}): Promise<SessionGuidance | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4o-mini";

  const system = `You summarize outcomes of a small-group safety check-in app (Urgentic).
Rules:
- Output ONLY valid JSON with keys "title" (string) and "bullets" (array of strings, max 5 short lines).
- Be practical and calm. No medical or legal advice. Do not claim you know what happened.
- If alertType is "unsafe" and NO contact responded successfully, include a bullet that says to call 911 or local emergency if in immediate danger, and to move to a public area if possible.
- If some contacts responded and some did not, say who to prioritize and suggest texting those who did not answer.
- Mention the reporter's shared location in a bullet if reporterLocation is non-empty and not literally "Location unavailable".
- Keep total tone appropriate: more serious for "unsafe", lighter for "awkward".
- if none responded, still try to recommend some course of action that could help e.g: go to public area, bright lights, find police`;

  const userPayload = {
    alertType: params.alertType,
    reporterLocation: params.reporterLocation,
    contacts: params.contacts.map((c) => ({
      name: c.name,
      status: c.status,
      response: c.response,
      theirLocation: c.theirLocation,
    })),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Summarize this session for the person who requested help:\n${JSON.stringify(userPayload)}`,
        },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    console.error("session-ai-summary OpenAI", data.error?.message || res.status);
    return null;
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  return parseSessionGuidanceJson(content);
}
