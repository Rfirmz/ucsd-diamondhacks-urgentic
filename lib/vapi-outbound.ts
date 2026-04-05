export type AlertType = "unsafe" | "awkward";

export type ContactForCall = {
  id: string;
  contact_name: string;
  user_name: string;
  contact_phone: string;
};

export function buildVapiPhonePayload(params: {
  alertId: string;
  contact: ContactForCall;
  alertType: AlertType;
  location: string;
  phoneNumberId: string;
  assistantId: string;
  appUrl: string;
}) {
  const { alertId, contact, alertType, location: loc, phoneNumberId, assistantId, appUrl } = params;

  const firstMessage =
    alertType === "unsafe"
      ? `Hey, I'm calling from Urgentic with an urgent message for ${contact.contact_name}. ${contact.user_name} is feeling unsafe right now and needs your help. Their approximate location is ${loc}. Here's what you can do — you can say I'm coming now, meet at a public place, call security, or stay where you are. What would you like to do?`
      : `Hey ${contact.contact_name}, I'm calling from Urgentic. Nothing dangerous, but ${contact.user_name} is in an uncomfortable situation and could use a hand getting out of it. Here's what you can do — you can say call them with an excuse, text them a fake emergency, come meet them, or stay put I'll figure something out. What works best for you?`;

  const systemContent =
    alertType === "unsafe"
      ? `You are a voice agent for Urgentic, an emergency safety app. You're calling ${contact.contact_name} because ${contact.user_name} has triggered an urgent safety alert. This is serious. Keep your tone calm but urgent. Speak like a real person delivering important news, not like a robot reading a script. Use short, natural sentences. Here's what you need to do: Tell them ${contact.user_name} feels unsafe and needs help right now. Their location is ${loc}. Give them four options: "I'm coming now," "Meet at a public place," "Call security," or "Stay where you are." Once they pick one, ask where they currently are so you can pass that info along. Confirm their choice and location back to them. Thank them and hang up. If they're confused, just calmly repeat the four options. If their answer is close to one of the options but not exact, go with the closest match and confirm it. If they ask questions about what happened, just say you don't have more details and ask them to pick an option. Don't explain how the app works. Don't make small talk. Keep the whole call under a minute.`
      : `You are a voice agent for Urgentic, a personal safety app. You're calling ${contact.contact_name} because their friend ${contact.user_name} has used Urgentic to signal that they are in an awkward or uncomfortable situation and want a way out. This is NOT a dangerous emergency. Keep your tone friendly, casual, and lighthearted, like a helpful friend relaying a message. Here's what you need to do: Let them know ${contact.user_name} could use some help getting out of an uncomfortable situation. Give them four options: "Call them with an excuse," "Text them a fake emergency," "Come meet them," or "Stay put, I'll figure something out." Once they pick one, ask where they currently are so you can pass that info along. Confirm their choice and location back to them. Thank them casually and end the call. If they're confused, briefly explain their friend used an app to let them know they'd like help leaving a situation, then repeat the options. If their answer is close to one of the options but not exact, go with the closest match and confirm it. Don't make it sound dramatic. Keep the call under 45 seconds.`;

  return {
    phoneNumberId,
    customer: { number: contact.contact_phone },
    assistantId,
    assistantOverrides: {
      firstMessage,
      model: {
        provider: process.env.VAPI_MODEL_PROVIDER || "openai",
        model: process.env.VAPI_MODEL_NAME || "gpt-4o",
        messages: [{ role: "system" as const, content: systemContent }],
      },
      serverUrl: `${appUrl.replace(/\/$/, "")}/api/vapi-webhook`,
      serverMessages: ["end-of-call-report"],
    },
    metadata: {
      alertId,
      contactId: contact.id,
      alertType,
    },
  };
}

export async function startVapiPhoneCall(apiKey: string, body: ReturnType<typeof buildVapiPhonePayload>) {
  const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const vapiData = (await vapiResponse.json().catch(() => ({}))) as { id?: string; message?: string };
  return { ok: vapiResponse.ok, vapiData };
}
