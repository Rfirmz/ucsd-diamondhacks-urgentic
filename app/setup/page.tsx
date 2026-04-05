"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setStoredContactId } from "@/lib/contact-storage";

export default function SetupPage() {
  const router = useRouter();
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
        setStoredContactId(data.id);
        router.push("/");
        return;
      }
      setError("No contact id returned");
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#0c1222] px-5 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-slate-100">Setup</h1>
      <p className="mb-8 text-sm text-slate-400">
        One trusted contact for alerts. You can change this anytime from the home screen.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
          className="mt-2 h-12 rounded-xl bg-sky-600 text-base font-medium text-white hover:bg-sky-500"
        >
          {saving ? "Saving…" : "Save & continue"}
        </Button>
      </form>
    </div>
  );
}
