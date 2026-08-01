import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import AnalyticsProvider from "@/components/analytics-provider";
import ClerkThemeProvider from "@/components/clerk-theme-provider";
import AppChrome from "@/components/studio-shell/app-chrome";
import AppRouteGuard from "@/components/studio-shell/app-route-guard";
import { Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { getSiteUrl } from "@/lib/json-ld";

// One geo-grotesque family across display + body (Aave-style). Hanken Grotesk
// is our free stand-in for Aave's paid FT Regola Neue. `--font-body-sans` and
// `--font-display-sans` are aliased to it in globals.css so existing refs work.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();
const title = "Yapper | The Mobile and Desktop Content Studio for Creators";
const description =
  "Capture ideas, develop scripts, record with a teleprompter, edit video by transcript, and publish in one mobile and desktop creator studio.";

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
    "desktop video editor",
    "creator studio",
    "transcript video editor",
    "teleprompter recorder",
    "AI script writer for video",
    "content idea capture",
    "automatic video captions",
    "content calendar for creators",
    "social media publishing tool",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "software",
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Yapper",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Yapper Studio: from idea to posted video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@ypr.app",
    site: "@ypr.app",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
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
      data-scroll-behavior="smooth"
      className={`${hanken.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-09JET8C3M0"
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-09JET8C3M0');`}
        </Script>
        {/* Explicit favicon tags to avoid browser/metadata inconsistencies. */}
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="yapper-theme"
        >
          <ClerkThemeProvider>
            <Suspense fallback={null}>
              <AnalyticsProvider />
            </Suspense>
            {/* Desktop app: flag the shell and keep it locked to Studio (web no-op). */}
            <AppChrome />
            <AppRouteGuard />
            {children}
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
