"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mb-8 text-sm text-sky-400/90 hover:text-sky-300"
      >
        ← Home
      </button>

      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-white">Contacts</h1>

      <Button
        type="button"
        onClick={() => router.push("/setup?next=/contacts")}
        className="urgentic-glow-sky mb-8 h-11 w-full rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 font-semibold text-white hover:brightness-110"
      >
        Add contact
      </Button>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-slate-500">No contacts</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="urgentic-glass flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{c.contactName}</p>
                <p className="text-sm text-slate-500">{c.contactPhone}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFromDevice(c.id)}
                className="shrink-0 text-sm text-red-400/90 hover:text-red-300"
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
