import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
    { media: "(prefers-color-scheme: dark)", color: "#1a2332" },
    { media: "(prefers-color-scheme: light)", color: "#1a2332" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", inter.variable)}>
      <body className="min-h-dvh bg-[#09090b] font-sans antialiased text-slate-100">
        <div className="urgentic-shell mx-auto min-h-dvh w-full max-w-[30rem]">{children}</div>
      </body>
    </html>
  );
}
