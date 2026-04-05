"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addStoredContactId } from "@/lib/contact-storage";

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [userName, setUserName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, contactName, contactPhone }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save");
        setSaving(false);
        return;
      }
      if (data.id) {
        addStoredContactId(data.id);
        router.push(nextPath);
        return;
      }
      setError("No contact id returned");
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-white">Add contact</h1>

      <form onSubmit={onSubmit} className="urgentic-glass flex flex-col gap-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="userName" className="text-slate-200">
            Your name
          </Label>
          <Input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            autoComplete="name"
            className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            placeholder="Alex"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName" className="text-slate-200">
            Contact&apos;s name
          </Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            autoComplete="off"
            className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            placeholder="Jordan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone" className="text-slate-200">
            Contact&apos;s phone (US)
          </Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
            autoComplete="tel"
            className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            placeholder="(555) 123-4567"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={saving}
          className="urgentic-glow-sky mt-1 h-12 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-sky-500 to-cyan-400 font-semibold text-white hover:brightness-110"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <SetupForm />
    </Suspense>
  );
}
