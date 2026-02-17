import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner"
import ConsoleNoiseFilter from "@/components/ConsoleNoiseFilter";
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
  title: "Signalist",
  description: "Track real-time stock prices, get personalized alerts and explore detailed company insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const noiseFilterBootstrap = `(() => {
    const blocked = [
      'telemetry.tradingview.com/widget/report',
      'tradingview-widget.com/support/support-portal-problems',
    ];

    const ignored = [
      'use moment.updateLocale(localeName, config) to change an existing locale',
      "Chart.DataProblemModel:Couldn't load support portal problems",
      'Fetch:/support/support-portal-problems/?language=',
      'telemetry.tradingview.com/widget/report',
      'ERR_BLOCKED_BY_ADBLOCKER',
      'Failed to fetch',
    ];

    const shouldBypass = (value) =>
      typeof value === 'string' && blocked.some((endpoint) => value.includes(endpoint));

    const toText = (arg) => {
      if (typeof arg === 'string') return arg;

      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    };

    const shouldIgnore = (args) => {
      const text = args.map((arg) => toText(arg)).join(' ');

      return ignored.some((message) => text.includes(message));
    };

    const originalFetch = window.fetch;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;
    const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
    const originalOpen = XMLHttpRequest.prototype.open;

    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (shouldBypass(url)) {
        return new Response(null, { status: 204, statusText: 'No Content' });
      }

      return originalFetch(input, init);
    };

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (shouldBypass(String(url))) {
        this.abort();
        return;
      }

      return originalOpen.call(this, method, url, ...rest);
    };

    if (originalSendBeacon) {
      navigator.sendBeacon = (url, data) => {
        const target = typeof url === 'string' ? url : url.toString();
        if (shouldBypass(target)) {
          return true;
        }

        return originalSendBeacon(url, data);
      };
    }

    console.warn = (...args) => {
      if (shouldIgnore(args)) return;
      originalWarn(...args);
    };

    console.error = (...args) => {
      if (shouldIgnore(args)) return;
      originalError(...args);
    };

    console.log = (...args) => {
      if (shouldIgnore(args)) return;
      originalLog(...args);
    };
  })();`;

  return (
    <html lang="en" className="dark">
      <head>
        <Script id="noise-filter" strategy="beforeInteractive">
          {noiseFilterBootstrap}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConsoleNoiseFilter />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
