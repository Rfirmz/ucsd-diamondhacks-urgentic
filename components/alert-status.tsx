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
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 bg-[#0c1222] px-5 text-center">
        <p className="text-red-300">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-transparent text-slate-200"
          onClick={() => router.push("/")}
        >
          Back to Home
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0c1222] text-slate-400">
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
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#0c1222] px-5 py-12">
        <h1 className="mb-4 text-xl font-semibold text-red-300">Couldn&apos;t complete the call</h1>
        <p className="mb-8 text-slate-400">
          The automated call didn&apos;t go through. You can try again from home or reach{" "}
          <span className="text-slate-200">{data.contactName}</span> directly.
        </p>
        <div className="mt-auto flex flex-col gap-3">
          {tel ? (
            <a
              href={tel}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-sky-600 text-base font-medium text-white transition-colors hover:bg-sky-500"
            >
              Call {data.contactName}
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl border-white/20 bg-transparent text-slate-200"
            onClick={() => router.push("/")}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isResponded) {
    const steps =
      data.nextSteps ||
      (data.contactResponse
        ? `${data.contactName} chose: ${data.contactResponse}`
        : "Your contact responded.");

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#0c1222] px-5 py-12">
        <h1 className="mb-6 text-xl font-semibold text-sky-300">Response received</h1>
        {data.contactResponse ? (
          <p className="mb-4 rounded-2xl border border-sky-500/30 bg-sky-950/40 p-5 text-lg leading-relaxed text-slate-100">
            {data.contactResponse}
          </p>
        ) : null}
        <p className="mb-4 text-base leading-relaxed text-slate-300">{steps}</p>
        {data.contactLocation ? (
          <p className="mb-8 text-sm text-slate-500">
            Their location: <span className="text-slate-300">{data.contactLocation}</span>
          </p>
        ) : (
          <div className="mb-8" />
        )}
        <Button
          type="button"
          className="mt-auto h-12 rounded-xl bg-sky-600 text-base font-medium text-white hover:bg-sky-500"
          onClick={() => router.push("/")}
        >
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-[#0c1222] px-5 py-12 text-center">
      <div
        className="mb-8 size-24 rounded-full bg-sky-500/20 ring-4 ring-sky-400/40 animate-pulse-soft"
        aria-hidden
      />
      <h1 className="text-xl font-medium text-slate-100 animate-pulse-soft">
        Calling {data.contactName}…
      </h1>
      <p className="mt-3 text-sm text-slate-500">We&apos;ll update this when they respond.</p>
    </div>
  );
}
