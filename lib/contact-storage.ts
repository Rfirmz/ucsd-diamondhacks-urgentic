const CONTACT_IDS_KEY = "urgentic_contact_ids";
/** @deprecated Legacy single contact; migrated into CONTACT_IDS_KEY */
const CONTACT_ID_KEY = "urgentic_contact_id";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

/** All contact UUIDs saved on this device (order = add order). */
export function getStoredContactIds(): string[] {
  if (typeof window === "undefined") return [];
  const fromArray = parseIds(window.localStorage.getItem(CONTACT_IDS_KEY));
  if (fromArray.length > 0) return fromArray;
  const legacy = window.localStorage.getItem(CONTACT_ID_KEY);
  if (legacy) return [legacy];
  return [];
}

export function setStoredContactIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  window.localStorage.setItem(CONTACT_IDS_KEY, JSON.stringify(unique));
  if (unique.length === 1) {
    window.localStorage.setItem(CONTACT_ID_KEY, unique[0]);
  } else {
    window.localStorage.removeItem(CONTACT_ID_KEY);
  }
}

export function addStoredContactId(id: string) {
  const ids = getStoredContactIds();
  if (ids.includes(id)) return;
  setStoredContactIds([...ids, id]);
}

export function removeStoredContactId(id: string) {
  setStoredContactIds(getStoredContactIds().filter((x) => x !== id));
}

/** First saved contact, for backward compatibility. */
export function getStoredContactId(): string | null {
  const ids = getStoredContactIds();
  return ids[0] ?? null;
}

/** Replace list with a single id (e.g. legacy flows). */
export function setStoredContactId(id: string) {
  setStoredContactIds([id]);
}
