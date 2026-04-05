export function getNextSteps(
  contactName: string,
  alertType: string,
  contactResponse: string | null
): string | null {
  if (!contactResponse) return null;
  const r = contactResponse.toLowerCase().trim();

  if (alertType === "unsafe") {
    if (r.includes("i'm coming now") || r.includes("im coming now") || (r.includes("coming") && r.includes("now")))
      return `${contactName} is on their way. Stay where you are if it's safe.`;
    if (r.includes("public place") || r.includes("meet at"))
      return `${contactName} wants you to move to a nearby public place.`;
    if (r.includes("call security") || r.includes("security"))
      return `${contactName} is calling security. Stay in a visible area.`;
    if (r.includes("stay where you are") || (r.includes("stay where") && r.includes("are")))
      return `${contactName} says stay put. Help is being arranged.`;
    return null;
  }

  if (alertType === "awkward") {
    if (r.includes("excuse"))
      return `${contactName} is going to call you with an excuse to leave.`;
    if (r.includes("fake emergency") || (r.includes("text") && r.includes("emergency")))
      return `${contactName} will text you a fake emergency. Check your phone.`;
    if (r.includes("come meet") || r.includes("coming to meet"))
      return `${contactName} is coming to meet you.`;
    if (r.includes("stay put") || r.includes("figure something out"))
      return `${contactName} is working on getting you out. Hang tight.`;
    return null;
  }

  return null;
}
