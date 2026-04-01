import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const bodySans = Manrope({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displaySerif = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const siteUrl = "https://ypr.app";
const title = "Yapper | Free Topic Generator for Speech Practice";
const description =
  "Free random topic generator for impromptu speaking practice, table topics, and speech prompts. Built-in timer, optional recording, and no sign-up.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Yapper",
  },
  description,
  applicationName: "Yapper",
  authors: [{ name: "Yapper", url: siteUrl }],
  creator: "Yapper",
  keywords: [
    "random topic generator",
    "impromptu speaking practice",
    "speech topic generator",
    "random speech topic generator",
    "table topics questions",
    "toastmasters table topics",
    "impromptu speech topics",
    "speaking prompts",
    "public speaking practice online",
    "free speaking practice",
    "impromptu speech prompts",
    "random speaking topics",
    "1 minute speech topics",
    "ESL speaking practice online free",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "education",
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Yapper",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#282828" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displaySerif.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('yapper-dark')==='true'||(!localStorage.getItem('yapper-dark')&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch{}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
