"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SessionAlert = {
  id: string;
  status: string;
  contactName: string;
  contactPhone: string | null;
  contactResponse: string | null;
  contactLocation: string | null;
  nextSteps: string | null;
  createdAt: string;
};

type SessionGuidance = {
  title: string;
  bullets: string[];
};

type NearestSafePlace = {
  name: string;
  fullAddress: string | null;
  categoryTried: string;
  distanceMeters: number;
  originLng: number;
  originLat: number;
  destinationLng: number;
  destinationLat: number;
  directionsUrl: string;
};

type SessionPayload = {
  sessionId: string;
  alertType: string;
  location: string | null;
  aiGuidance: SessionGuidance | null;
  nearestSafePlace: NearestSafePlace | null;
  alerts: SessionAlert[];
};

function markersShowYouAndPlace(p: NearestSafePlace): boolean {
  return (
    Math.abs(p.originLng - p.destinationLng) > 1e-6 ||
    Math.abs(p.originLat - p.destinationLat) > 1e-6
  );
}

export function AlertSessionStatus({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SessionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapBroken, setMapBroken] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/alert/session/${sessionId}`, { cache: "no-store" });
      const json = (await res.json()) as SessionPayload & { error?: string };
      if (!res.ok) {
        setLoadError(json.error || "Not found");
        return;
      }
      setData({
        sessionId: json.sessionId,
        alertType: json.alertType,
        location: json.location ?? null,
        aiGuidance: json.aiGuidance ?? null,
        nearestSafePlace: json.nearestSafePlace ?? null,
        alerts: json.alerts ?? [],
      });
      setLoadError(null);
    } catch {
      setLoadError("Network error");
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    setMapBroken(false);
  }, [sessionId, data?.nearestSafePlace?.destinationLng, data?.nearestSafePlace?.destinationLat]);

  const allTerminal =
    data?.alerts.length &&
    data.alerts.every((a) => a.status === "responded" || a.status === "failed");

  useEffect(() => {
    if (allTerminal) return;
    const t = setInterval(fetchSession, 3000);
    return () => clearInterval(t);
  }, [fetchSession, allTerminal]);

  if (loadError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-red-300">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          className="urgentic-glass border-white/15 bg-transparent text-slate-200 hover:bg-white/5"
          onClick={() => router.push("/")}
        >
          Home
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  const { alerts } = data;
  const pending = alerts.filter((a) => a.status === "calling" || a.status === "pending");

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10 pb-14">
      <h1 className="mb-8 text-xl font-semibold tracking-tight text-white">
        {pending.length > 0 ? "Calling…" : "Status"}
      </h1>

      <ul className="flex flex-col gap-4">
        {alerts.map((a) => (
          <li key={a.id} className="urgentic-glass p-4 text-left">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-slate-100">{a.contactName}</span>
              <span
                className={
                  a.status === "responded"
                    ? "text-xs font-medium text-emerald-400"
                    : a.status === "failed"
                      ? "text-xs font-medium text-red-400"
                      : "text-xs font-medium text-amber-400"
                }
              >
                {a.status === "calling" || a.status === "pending"
                  ? "Calling…"
                  : a.status === "responded"
                    ? "Responded"
                    : a.contactResponse === "No response" || !a.contactResponse?.trim()
                      ? "No response"
                      : "Failed"}
              </span>
            </div>

            {a.status === "responded" && a.contactResponse ? (
              <>
                <p className="mb-2 text-base leading-relaxed text-slate-200">{a.contactResponse}</p>
                {a.nextSteps ? (
                  <p className="mb-2 text-sm text-slate-500">{a.nextSteps}</p>
                ) : null}
                {a.contactLocation ? (
                  <p className="text-xs text-slate-500">
                    <span className="text-slate-500">Location </span>
                    <span className="text-slate-300">{a.contactLocation}</span>
                  </p>
                ) : null}
              </>
            ) : null}

            {a.status === "failed" ? (
              <p className="text-sm text-red-300/90">
                {a.contactResponse === "No response" || !a.contactResponse?.trim()
                  ? "No answer or hung up."
                  : a.contactResponse}
              </p>
            ) : null}

            {(a.status === "calling" || a.status === "pending") && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span
                  className="inline-block size-2 animate-pulse rounded-full bg-amber-400/90"
                  aria-hidden
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {allTerminal && data.aiGuidance ? (
        <div className="mt-8 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-200/90">
            What to do now
          </h2>
          <p className="mb-3 text-base font-medium text-white">{data.aiGuidance.title}</p>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-200">
            {data.aiGuidance.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {allTerminal && data.nearestSafePlace ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-200/90">
            Nearest public place
          </h2>
          <p className="text-base font-medium text-white">{data.nearestSafePlace.name}</p>
          {data.nearestSafePlace.fullAddress ? (
            <p className="mt-1 text-sm text-slate-300">{data.nearestSafePlace.fullAddress}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-400">
            About {Math.round(data.nearestSafePlace.distanceMeters)} m away ·{" "}
            {data.nearestSafePlace.categoryTried.replace(/_/g, " ")}
          </p>

          {!mapBroken ? (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 shadow-inner">
                <Image
                  src={`/api/map/session/${encodeURIComponent(sessionId)}`}
                  alt={`Map near ${data.nearestSafePlace.name}`}
                  width={600}
                  height={288}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  unoptimized
                  onError={() => setMapBroken(true)}
                />
              </div>
              {markersShowYouAndPlace(data.nearestSafePlace) ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
                    Your search area
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-cyan-400" aria-hidden />
                    Suggested place
                  </span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Map preview unavailable.</p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Suggestions are approximate. Verify hours and safety before you go. Not a substitute for
            911.
          </p>
          <a
            href={data.nearestSafePlace.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
          >
            Walking directions
          </a>
        </div>
      ) : null}

      {allTerminal ? (
        <Button
          type="button"
          className="urgentic-glow-sky mt-8 h-12 w-full rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 font-semibold text-white hover:brightness-110"
          onClick={() => router.push("/")}
        >
          Home
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="urgentic-glass mt-8 h-12 w-full rounded-2xl border-white/10 bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
          onClick={() => router.push("/")}
        >
          Home
        </Button>
      )}
    </div>
  );
}
