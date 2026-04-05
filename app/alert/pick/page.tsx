"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    setLoadingList(true);
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

  if (loadingList) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-8 text-sm text-sky-400/90 hover:text-sky-300"
      >
        ← Back
      </button>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-white">Select contacts</h1>
      <p className="mb-6 text-sm leading-relaxed text-slate-400">
        When you tap Call, your browser may ask to share location so the voice message can describe
        where you are. You can still send an alert if you decline.
      </p>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={selectAll}
          className="text-xs font-medium text-slate-500 hover:text-slate-400"
        >
          Select all
        </button>
      </div>

      <ul className="mb-8 flex flex-col gap-3">
        {contacts.map((c) => {
          const on = selected.has(c.id);
          return (
            <li key={c.id}>
              <label className="urgentic-glass flex cursor-pointer items-start gap-3 p-4 transition hover:border-white/[0.12] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500/60">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(c.id)}
                  className="mt-1 size-4 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-sky-500/50"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-100">{c.contactName}</span>
                  <span className="block text-sm text-slate-500">{c.contactPhone}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mb-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={starting || selected.size === 0}
        onClick={startCalls}
        className="urgentic-glow-sky h-12 w-full rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 text-base font-semibold text-white hover:brightness-110 disabled:opacity-45"
      >
        {starting ? "Starting…" : "Call"}
      </Button>
    </div>
  );
}

export default function PickContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <PickContactsInner />
    </Suspense>
  );
}
