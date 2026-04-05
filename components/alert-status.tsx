"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  const terminal =
    data?.status === "responded" || data?.status === "failed";

  useEffect(() => {
    if (terminal) return;
    const t = setInterval(fetchAlert, 3000);
    return () => clearInterval(t);
  }, [fetchAlert, terminal]);

  if (loadError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-red-300">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          className="urgentic-glass border-white/15 bg-transparent text-slate-200"
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

  const isFailed = data.status === "failed";
  const isResponded = data.status === "responded";

  if (isFailed) {
    const tel = data.contactPhone?.replace(/\D/g, "")
      ? `tel:${data.contactPhone.replace(/\s/g, "")}`
      : null;
    const noResponse =
      data.contactResponse === "No response" || !data.contactResponse?.trim();
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-12">
        <h1 className="mb-4 text-xl font-semibold text-red-300">
          {noResponse ? "No response" : "Call failed"}
        </h1>
        <p className="mb-8 text-sm text-slate-500">
          {noResponse ? (
            <span className="text-red-200/80">No answer or hung up.</span>
          ) : (
            <>
              Try again or call <span className="text-slate-300">{data.contactName}</span> directly.
            </>
          )}
        </p>
        <div className="mt-auto flex flex-col gap-3">
          {tel ? (
            <a
              href={tel}
              className="urgentic-glow-sky inline-flex h-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 text-base font-semibold text-white hover:brightness-110"
            >
              Call {data.contactName}
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="urgentic-glass h-12 rounded-2xl border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.06]"
            onClick={() => router.push("/")}
          >
            Home
          </Button>
        </div>
      </div>
    );
  }

  if (isResponded) {
    const steps = data.nextSteps;

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-12">
        <h1 className="mb-6 text-xl font-semibold text-sky-300">Response</h1>
        {data.contactResponse ? (
          <div className="urgentic-glass mb-4 border-sky-500/20 p-5">
            <p className="text-lg leading-relaxed text-slate-100">{data.contactResponse}</p>
          </div>
        ) : null}
        {steps ? <p className="mb-4 text-sm text-slate-500">{steps}</p> : null}
        {data.contactLocation ? (
          <p className="mb-8 text-xs text-slate-500">
            <span className="text-slate-500">Location </span>
            <span className="text-slate-300">{data.contactLocation}</span>
          </p>
        ) : (
          <div className="mb-8" />
        )}
        <Button
          type="button"
          className="urgentic-glow-sky mt-auto h-12 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 font-semibold text-white hover:brightness-110"
          onClick={() => router.push("/")}
        >
          Home
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <div
        className="mb-10 size-24 rounded-full bg-sky-500/15 ring-2 ring-sky-400/30 ring-offset-4 ring-offset-[#1a2332] animate-pulse-soft"
        aria-hidden
      />
      <h1 className="text-xl font-medium text-white animate-pulse-soft">
        Calling {data.contactName}…
      </h1>
    </div>
  );
}
