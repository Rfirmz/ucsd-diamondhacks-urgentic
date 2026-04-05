"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CallingRing } from "@/components/calling-ring";

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

function statusBadgeClasses(status: string): string {
  if (status === "responded") {
    return "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200/95";
  }
  if (status === "failed") {
    return "border-red-500/20 bg-red-500/[0.06] text-red-200/90";
  }
  return "border-amber-500/25 bg-amber-500/[0.07] text-amber-100/90";
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
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
        <p className="text-sm text-red-300/95">{loadError}</p>
        <button type="button" className="urgentic-btn-ghost max-w-[12rem]" onClick={() => router.push("/")}>
          Home
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-5 py-10 pb-16" aria-busy="true">
        <header className="mb-8 border-b border-white/[0.06] pb-6">
          <p className="urgentic-section-label mb-1.5">Session</p>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Outbound calls</h1>
        </header>
        <ul className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <li key={i}>
              <div className="urgentic-glass h-[5.5rem] animate-pulse bg-white/[0.04]" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { alerts } = data;
  const pending = alerts.filter((a) => a.status === "calling" || a.status === "pending");

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10 pb-16">
      <header className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="urgentic-section-label mb-1.5">Session</p>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
          {pending.length > 0 ? "Outbound calls" : "Call results"}
        </h1>
        {pending.length > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Waiting for contacts to answer.</p>
        ) : null}
      </header>

      <ul className="flex flex-col gap-3">
        {alerts.map((a) => {
          const waiting = a.status === "calling" || a.status === "pending";
          const label =
            waiting
              ? "Calling…"
              : a.status === "responded"
                ? "Responded"
                : a.contactResponse === "No response" || !a.contactResponse?.trim()
                  ? "No response"
                  : "Failed";

          return (
            <li key={a.id} className="urgentic-glass p-4 text-left">
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="font-medium leading-snug text-zinc-100">{a.contactName}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClasses(a.status)}`}
                >
                  {label}
                </span>
              </div>

              {a.status === "responded" && a.contactResponse ? (
                <>
                  <p className="text-[15px] leading-relaxed text-zinc-300">{a.contactResponse}</p>
                  {a.nextSteps ? (
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">{a.nextSteps}</p>
                  ) : null}
                  {a.contactLocation ? (
                    <p className="mt-3 text-xs text-zinc-500">
                      <span className="text-zinc-600">Their location · </span>
                      <span className="text-zinc-400">{a.contactLocation}</span>
                    </p>
                  ) : null}
                </>
              ) : null}

              {a.status === "failed" ? (
                <p className="text-sm leading-relaxed text-red-200/85">
                  {a.contactResponse === "No response" || !a.contactResponse?.trim()
                    ? "No answer or the call ended."
                    : a.contactResponse}
                </p>
              ) : null}

              {waiting ? (
                <div className="mt-4 flex items-center gap-3 border-t border-white/[0.05] pt-3.5">
                  <CallingRing size="sm" />
                  <span className="text-[13px] text-zinc-500">Ringing…</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {allTerminal && data.aiGuidance ? (
        <div className="mt-8 rounded-lg border border-white/[0.06] bg-zinc-950/40 p-5">
          <div className="mb-4 border-l-2 border-zinc-500/50 pl-3">
            <h2 className="urgentic-section-label mb-0">Guidance</h2>
            <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-100">
              {data.aiGuidance.title}
            </p>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-zinc-400">
            {data.aiGuidance.bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-px w-3 shrink-0 bg-zinc-600" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {allTerminal && data.nearestSafePlace ? (
        <div className="mt-5 rounded-lg border border-white/[0.06] bg-zinc-950/40 p-5">
          <h2 className="urgentic-section-label mb-3">Nearby place</h2>
          <p className="text-[15px] font-medium text-zinc-100">{data.nearestSafePlace.name}</p>
          {data.nearestSafePlace.fullAddress ? (
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{data.nearestSafePlace.fullAddress}</p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-600">
            ~{Math.round(data.nearestSafePlace.distanceMeters)} m ·{" "}
            {data.nearestSafePlace.categoryTried.replace(/_/g, " ")}
          </p>

          {!mapBroken ? (
            <>
              <div className="mt-4 overflow-hidden rounded-md border border-white/[0.06] bg-black/20">
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
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500/80" aria-hidden />
                    You
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-cyan-500/80" aria-hidden />
                    Place
                  </span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-xs text-zinc-600">Map preview unavailable.</p>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            Approximate suggestion. Confirm safety and hours. Not a substitute for emergency services.
          </p>
          <a
            href={data.nearestSafePlace.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex h-11 w-full items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-sm font-medium text-zinc-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.07]"
          >
            Walking directions
          </a>
        </div>
      ) : null}

      {allTerminal ? (
        <button type="button" className="urgentic-btn-primary mt-10" onClick={() => router.push("/")}>
          Home
        </button>
      ) : (
        <button type="button" className="urgentic-btn-ghost mt-10" onClick={() => router.push("/")}>
          Home
        </button>
      )}
    </div>
  );
}
