"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CallingRing } from "@/components/calling-ring";

type AlertPayload = {
  id: string;
  status: string;
  alertType: string;
  location: string | null;
  contactResponse: string | null;
  contactLocation: string | null;
  contactName: string;
  contactPhone: string | null;
  nextSteps: string | null;
  createdAt: string;
};

export function AlertStatus({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AlertPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAlert = useCallback(async () => {
    try {
      const res = await fetch(`/api/alert/${alertId}`, { cache: "no-store" });
      const json = (await res.json()) as AlertPayload & { error?: string };
      if (!res.ok) {
        setLoadError(json.error || "Not found");
        return;
      }
      setData(json);
      setLoadError(null);
    } catch {
      setLoadError("Network error");
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const terminal = data?.status === "responded" || data?.status === "failed";

  useEffect(() => {
    if (terminal) return;
    const t = setInterval(fetchAlert, 3000);
    return () => clearInterval(t);
  }, [fetchAlert, terminal]);

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
      <div className="mx-auto min-h-dvh max-w-md px-5 py-10" aria-busy="true">
        <header className="mb-6 border-b border-white/[0.06] pb-5">
          <p className="urgentic-section-label mb-1">Alert</p>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Status</h1>
        </header>
        <div className="urgentic-glass h-36 animate-pulse bg-white/[0.04]" />
      </div>
    );
  }

  const isFailed = data.status === "failed";
  const isResponded = data.status === "responded";

  if (isFailed) {
    const tel = data.contactPhone?.replace(/\D/g, "")
      ? `tel:${data.contactPhone.replace(/\s/g, "")}`
      : null;
    const noResponse =
      data.contactResponse === "No response" || !data.contactResponse?.trim();
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
        <header className="mb-6 border-b border-white/[0.06] pb-5">
          <p className="urgentic-section-label mb-1">Alert</p>
          <h1 className="text-lg font-semibold tracking-tight text-red-200/95">
            {noResponse ? "No response" : "Call failed"}
          </h1>
        </header>
        <p className="mb-10 text-sm leading-relaxed text-zinc-500">
          {noResponse ? (
            <span className="text-red-200/75">No answer or the call ended.</span>
          ) : (
            <>
              Try again or reach <span className="text-zinc-300">{data.contactName}</span> directly.
            </>
          )}
        </p>
        <div className="mt-auto flex flex-col gap-3">
          {tel ? (
            <a href={tel} className="urgentic-btn-primary text-center no-underline">
              Call {data.contactName}
            </a>
          ) : null}
          <button type="button" className="urgentic-btn-ghost" onClick={() => router.push("/")}>
            Home
          </button>
        </div>
      </div>
    );
  }

  if (isResponded) {
    const steps = data.nextSteps;

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
        <header className="mb-6 border-b border-white/[0.06] pb-5">
          <p className="urgentic-section-label mb-1">Response</p>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">{data.contactName}</h1>
        </header>
        {data.contactResponse ? (
          <div className="urgentic-glass mb-5 p-4">
            <p className="text-[15px] leading-relaxed text-zinc-200">{data.contactResponse}</p>
          </div>
        ) : null}
        {steps ? <p className="mb-4 text-sm leading-relaxed text-zinc-500">{steps}</p> : null}
        {data.contactLocation ? (
          <p className="mb-10 text-xs text-zinc-600">
            <span className="text-zinc-600">Their location · </span>
            <span className="text-zinc-400">{data.contactLocation}</span>
          </p>
        ) : (
          <div className="mb-10" />
        )}
        <button type="button" className="urgentic-btn-primary mt-auto" onClick={() => router.push("/")}>
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <CallingRing size="lg" className="mb-8" />
      <p className="urgentic-section-label mb-3">Calling</p>
      <h1 className="max-w-[16rem] text-lg font-medium leading-snug tracking-tight text-zinc-100">
        {data.contactName}
      </h1>
      <p className="mt-3 text-sm text-zinc-500">Waiting for an answer…</p>
    </div>
  );
}
