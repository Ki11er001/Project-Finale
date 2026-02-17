'use client';

import { useEffect } from 'react';

const IGNORED_MESSAGES = [
  'use moment.updateLocale(localeName, config) to change an existing locale',
  'Chart.DataProblemModel:Couldn\'t load support portal problems',
  'Fetch:/support/support-portal-problems/?language=',
  'telemetry.tradingview.com/widget/report',
  'ERR_BLOCKED_BY_ADBLOCKER',
];

const shouldIgnore = (args: unknown[]) => {
  const text = args
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join(' ');

  return IGNORED_MESSAGES.some((message) => text.includes(message));
};

const IGNORED_ENDPOINTS = [
  'tradingview-widget.com/support/support-portal-problems',
  'telemetry.tradingview.com/widget/report',
];

const shouldBypassRequest = (input: RequestInfo | URL) => {
  const requestUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return IGNORED_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));
};

export default function ConsoleNoiseFilter() {
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;
    const originalFetch = window.fetch;

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

    window.fetch = async (input, init) => {
      if (shouldBypassRequest(input)) {
        return new Response(null, { status: 204, statusText: 'No Content' });
      }

      return originalFetch(input, init);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
