"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { getStoredContactId } from "@/lib/contact-storage";
import { Button } from "@/components/ui/button";

function getLocation(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve("Location unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      () => resolve("Location unavailable"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

export function HomeScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState<"unsafe" | "awkward" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredContactId()) {
      router.replace("/setup");
      return;
    }
    setReady(true);
  }, [router]);

  async function trigger(alertType: "unsafe" | "awkward") {
    const contactId = getStoredContactId();
    if (!contactId) {
      router.replace("/setup");
      return;
    }
    setError(null);
    setLoading(alertType);
    try {
      const location = await getLocation();
      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, alertType, location }),
      });
      const data = (await res.json()) as { alertId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(null);
        return;
      }
      if (data.alertId) {
        router.push(`/alert/${data.alertId}`);
        return;
      }
      setError("No alert id returned");
    } catch {
      setError("Network error");
    }
    setLoading(null);
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0c1222] text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-[#0c1222] px-5 pb-10 pt-14">
      <button
        type="button"
        onClick={() => router.push("/setup")}
        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
        aria-label="Settings"
      >
        <Settings className="size-6" />
      </button>

      <h1 className="mb-12 text-center text-3xl font-semibold tracking-tight text-slate-100">
        Urgentic
      </h1>

      <div className="flex flex-1 flex-col gap-5">
        <Button
          type="button"
          disabled={loading !== null}
          onClick={() => trigger("unsafe")}
          className="h-auto min-h-[120px] rounded-2xl border-0 bg-[#9b1c1c] py-6 text-lg font-semibold text-white shadow-lg shadow-red-950/40 hover:bg-[#b91c1c]"
        >
          {loading === "unsafe" ? "Starting…" : "I Feel Unsafe"}
        </Button>
        <Button
          type="button"
          disabled={loading !== null}
          onClick={() => trigger("awkward")}
          className="h-auto min-h-[120px] rounded-2xl border-0 bg-[#d97706] py-6 text-lg font-semibold text-slate-900 shadow-lg shadow-amber-950/30 hover:bg-[#f59e0b]"
        >
          {loading === "awkward" ? "Starting…" : "Awkward Situation"}
        </Button>
      </div>

      {error ? (
        <p className="mt-6 text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
