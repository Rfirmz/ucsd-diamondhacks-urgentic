"use client";

import { useLayoutEffect, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { getStoredContactIds } from "@/lib/contact-storage";
import { Button } from "@/components/ui/button";
import urgenticLogo from "@/components/logo/Urgentic.png";

export function HomeScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (getStoredContactIds().length === 0) {
      router.replace("/setup");
      return;
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    router.prefetch("/alert/pick?type=unsafe");
    router.prefetch("/alert/pick?type=awkward");
    router.prefetch("/contacts");
    router.prefetch("/setup");
  }, [router]);

  function goPick(alertType: "unsafe" | "awkward") {
    router.push(`/alert/pick?type=${alertType}`);
  }

  if (!ready) {
    return <div className="min-h-dvh" aria-busy="true" />;
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-16">
      <button
        type="button"
        onClick={() => router.push("/contacts")}
        className="urgentic-glass absolute right-4 top-4 rounded-lg p-2.5 text-zinc-500 transition hover:border-white/[0.1] hover:text-zinc-300"
        aria-label="Contacts"
      >
        <Settings className="size-5" />
      </button>

      <div className="urgentic-logo-slot relative mx-auto mb-14 flex min-h-[132px] w-[min(94vw,320px)] items-center justify-center px-1 sm:min-h-[152px]">
        <div className="urgentic-logo-ambient" aria-hidden />
        <Image
          src={urgenticLogo}
          alt=""
          width={320}
          height={148}
          aria-hidden
          className="urgentic-logo-halo-wide pointer-events-none absolute inset-0 m-auto h-full max-h-[148px] w-full max-w-[300px] object-contain"
        />
        <Image
          src={urgenticLogo}
          alt=""
          width={320}
          height={148}
          aria-hidden
          className="urgentic-logo-halo-tight pointer-events-none absolute inset-0 m-auto h-full max-h-[148px] w-full max-w-[300px] object-contain"
        />
        <Image
          src={urgenticLogo}
          alt="Urgentic"
          width={320}
          height={148}
          className="urgentic-logo-mark relative h-auto w-full max-w-[300px] object-contain"
          priority
        />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <Button
          type="button"
          onClick={() => goPick("unsafe")}
          className="urgentic-glow-red h-auto min-h-[128px] rounded-lg border border-red-600/35 !bg-[#b91c1c] py-7 text-xl font-bold tracking-tight !text-white transition-colors hover:!bg-[#dc2626] hover:!text-white"
        >
          I feel unsafe
        </Button>
        <Button
          type="button"
          onClick={() => goPick("awkward")}
          className="urgentic-glow-amber h-auto min-h-[128px] rounded-lg border border-amber-600/35 !bg-[#d97706] py-7 text-xl font-bold tracking-tight !text-white transition-colors hover:!bg-[#f59e0b] hover:!text-white"
        >
          Awkward situation
        </Button>
      </div>
    </div>
  );
}
