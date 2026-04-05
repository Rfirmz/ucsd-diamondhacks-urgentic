"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10">
      <header className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="urgentic-section-label mb-1.5">Directory</p>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Add contact</h1>
      </header>

      <form onSubmit={onSubmit} className="urgentic-glass flex flex-col gap-5 p-5">
        <div className="space-y-2">
          <Label htmlFor="userName" className="text-zinc-300">
            Your name
          </Label>
          <Input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            autoComplete="name"
            className="rounded-md border-white/[0.08] bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600"
            placeholder="Alex"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName" className="text-zinc-300">
            Contact&apos;s name
          </Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            autoComplete="off"
            className="rounded-md border-white/[0.08] bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600"
            placeholder="Jordan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone" className="text-zinc-300">
            Contact&apos;s phone (US)
          </Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
            autoComplete="tel"
            className="rounded-md border-white/[0.08] bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600"
            placeholder="(555) 123-4567"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-300/95" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={saving} aria-busy={saving} className="urgentic-btn-primary mt-1">
          Save
        </button>
      </form>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-hidden />}>
      <SetupForm />
    </Suspense>
  );
}
