export const CONTACT_ID_KEY = "urgentic_contact_id";

export function getStoredContactId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CONTACT_ID_KEY);
}

export function setStoredContactId(id: string) {
  window.localStorage.setItem(CONTACT_ID_KEY, id);
}
