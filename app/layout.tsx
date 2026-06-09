import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { CANONICAL_DOMAIN } from "@/lib/site-config";
import "./globals.css";

const interBody = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const interHeading = Inter({
  subsets: ["latin"],
  variable: "--font-heading"
});

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_DOMAIN),
  title: "Bike Me | Cycling community on TestFlight",
  description:
    "Bike Me helps cyclists keep in touch, invite friends, and create private or public rides. Beta testers get 6 months of free Bike Me Pro at official launch.",
  openGraph: {
    title: "Bike Me | Cycling community on TestFlight",
    description:
      "Bike Me helps cyclists keep in touch, invite friends, and create private or public rides. Beta testers get 6 months of free Bike Me Pro at official launch.",
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
      <body className={`${interBody.variable} ${interHeading.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
