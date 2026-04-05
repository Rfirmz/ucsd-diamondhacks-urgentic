"use client";

import { useCallback, useEffect, useState } from "react";
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

type SessionPayload = {
  sessionId: string;
  alertType: string;
  location: string | null;
  alerts: SessionAlert[];
};

export function AlertSessionStatus({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SessionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/alert/session/${sessionId}`, { cache: "no-store" });
      const json = (await res.json()) as SessionPayload & { error?: string };
      if (!res.ok) {
        setLoadError(json.error || "Not found");
        return;
      }
      setData(json);
      setLoadError(null);
    } catch {
      setLoadError("Network error");
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

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
