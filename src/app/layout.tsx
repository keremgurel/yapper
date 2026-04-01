import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yapper — Random Speaking Topics",
  description:
    "Free random topic generator for impromptu speaking practice. No sign-up, no paywall, no friction. Just pull the lever and start talking.",
  metadataBase: new URL("https://ypr.app"),
  openGraph: {
    title: "Yapper — Random Speaking Topics",
    description:
      "Free random topic generator for impromptu speaking practice. Pull the lever and start talking.",
    url: "https://ypr.app",
    siteName: "Yapper",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yapper — Random Speaking Topics",
    description: "Free random topic generator for impromptu speaking practice.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
