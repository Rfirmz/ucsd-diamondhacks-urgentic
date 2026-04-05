"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CallingRing } from "@/components/calling-ring";
import { getStoredContactIds } from "@/lib/contact-storage";

type Contact = {
  id: string;
  userName: string;
  contactName: string;
  contactPhone: string;
};

function PickContactsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const alertType = typeParam === "unsafe" || typeParam === "awkward" ? typeParam : null;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const ids = getStoredContactIds();
    if (ids.length === 0) {
      router.replace("/setup");
      return;
    }
    try {
      const res = await fetch(`/api/contacts?ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { contacts?: Contact[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not load contacts");
        setLoadingList(false);
        return;
      }
      const list = data.contacts ?? [];
      setContacts(list);
      setSelected(new Set(list.map((c) => c.id)));
      setError(null);
    } catch {
      setError("Network error");
    }
    setLoadingList(false);
  }, [router]);

  useEffect(() => {
    if (!alertType) {
      router.replace("/");
      return;
    }
    loadContacts();
  }, [alertType, router, loadContacts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(contacts.map((c) => c.id)));
  }

  async function startCalls() {
    if (!alertType || selected.size === 0) return;
    setError(null);
    setStarting(true);
    try {
      const coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
      });

      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selected),
          alertType,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        error?: string;
        alerts?: { alertId: string; ok: boolean }[];
      };
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setStarting(false);
        return;
      }
      if (data.sessionId) {
        router.push(`/alert/session/${data.sessionId}`);
        return;
      }
      setError("No session id returned");
    } catch {
      setError("Network error");
    }
    setStarting(false);
  }

  if (!alertType) {
    return null;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10">
      <button type="button" onClick={() => router.back()} className="urgentic-link-back mb-8">
        ← Back
      </button>
      <header className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="urgentic-section-label mb-1.5">Recipients</p>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Select contacts</h1>
      </header>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={selectAll}
          disabled={loadingList || contacts.length === 0}
          className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-400 disabled:pointer-events-none disabled:opacity-35"
        >
          Select all
        </button>
      </div>

      <ul className="mb-8 flex flex-col gap-2.5">
        {loadingList
          ? [0, 1, 2].map((i) => (
              <li key={i}>
                <div className="urgentic-glass h-[4.25rem] animate-pulse bg-white/[0.04]" />
              </li>
            ))
          : null}
        {!loadingList &&
          contacts.map((c) => {
          const on = selected.has(c.id);
          return (
            <li key={c.id}>
              <label className="urgentic-glass flex cursor-pointer items-start gap-3 p-3.5 transition-colors hover:border-white/[0.08] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-500/40">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(c.id)}
                  className="mt-0.5 size-4 rounded border-white/15 bg-white/[0.06] text-zinc-300 accent-zinc-400 focus:ring-zinc-500/30"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-zinc-100">{c.contactName}</span>
                  <span className="block text-sm text-zinc-500">{c.contactPhone}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mb-4 text-sm text-red-300/95" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={starting || selected.size === 0 || loadingList}
        onClick={startCalls}
        aria-busy={starting}
        className="urgentic-btn-primary inline-flex min-h-12 items-center justify-center gap-2.5 disabled:opacity-40"
      >
        {starting ? <CallingRing size="sm" label="Placing calls" /> : "Place calls"}
      </button>
    </div>
  );
}

export default function PickContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-hidden />}>
      <PickContactsInner />
    </Suspense>
  );
}
