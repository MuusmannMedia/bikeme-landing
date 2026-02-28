import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import { CANONICAL_DOMAIN } from "@/lib/site-config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_DOMAIN),
  title: "Bike Me | Find rides. Join fast. Ride together.",
  description:
    "Bike Me helps cyclists discover nearby rides, create Ride Now meetups, and plan future rides - all from the map.",
  openGraph: {
    title: "Bike Me | Find rides. Join fast. Ride together.",
    description:
      "Bike Me helps cyclists discover nearby rides, create Ride Now meetups, and plan future rides - all from the map.",
    url: `${CANONICAL_DOMAIN}/en`,
    siteName: "Bike Me",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Bike Me preview"
      }
    ]
  },
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
