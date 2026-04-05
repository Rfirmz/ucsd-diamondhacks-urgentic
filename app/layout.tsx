import type { Metadata, Viewport } from "next";
import { IBM_Plex_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Urgentic",
  description: "Discreet safety communication when you need it",
  applicationName: "Urgentic",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Urgentic",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/favicon.ico" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
    { media: "(prefers-color-scheme: light)", color: "#14161c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", ibmPlexSerif.variable)}>
      <body className="min-h-dvh bg-[#14161c] font-serif antialiased text-zinc-100">
        <div className="urgentic-shell mx-auto min-h-dvh w-full max-w-[30rem]">{children}</div>
      </body>
    </html>
  );
}
