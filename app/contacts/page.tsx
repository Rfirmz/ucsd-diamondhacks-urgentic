"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredContactIds, removeStoredContactId } from "@/lib/contact-storage";

type Contact = {
  id: string;
  contactName: string;
  contactPhone: string;
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids = getStoredContactIds();
    if (ids.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { contacts?: Contact[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not load");
        setLoading(false);
        return;
      }
      setContacts(data.contacts ?? []);
      setError(null);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function removeFromDevice(id: string) {
    removeStoredContactId(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10">
      <button type="button" onClick={() => router.push("/")} className="urgentic-link-back mb-8">
        ← Home
      </button>

      <header className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="urgentic-section-label mb-1.5">Directory</p>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Contacts</h1>
      </header>

      <button
        type="button"
        onClick={() => router.push("/setup?next=/contacts")}
        className="urgentic-btn-primary mb-8"
      >
        Add contact
      </button>

      {loading ? (
        <ul className="flex flex-col gap-2.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="urgentic-glass h-[4.25rem] animate-pulse bg-white/[0.04]" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="text-sm text-red-300/95">{error}</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-zinc-500">No contacts saved on this device.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="urgentic-glass flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">{c.contactName}</p>
                <p className="text-sm text-zinc-500">{c.contactPhone}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFromDevice(c.id)}
                className="shrink-0 text-sm font-medium text-zinc-500 transition-colors hover:text-red-300/95"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
