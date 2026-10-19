import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MYCOFERT Burundi — Champignons frais et transformés + Engrais bio-organique",
    template: "%s — MYCOFERT Burundi",
  },
  description:
    "Producteur et transformateur de champignons, fournisseur de substrat et d'engrais bio-organiques, centre de formation en culture de champignons à Bujumbura, Burundi. Mushroom producer, substrate and bio-organic fertilizer supplier, and training provider.",
  keywords: [
    "MYCOFERT Burundi",
    "champignons Burundi",
    "mushrooms Burundi",
    "engrais bio-organique",
    "bio-organic fertilizer",
    "substrat de champignons",
    "mushroom substrate",
    "formation culture de champignons",
    "mushroom farming training",
    "Bujumbura",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MYCOFERT Burundi",
    description:
      "Champignons frais et transformés + engrais bio-organique. Des sols fertiles, des cultures productives.",
    siteName: "MYCOFERT Burundi",
    type: "website",
    locale: "fr_BI",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MYCOFERT Burundi",
    description: "Champignons frais et transformés + engrais bio-organique — Bujumbura, Burundi.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
