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

export default function ConsoleNoiseFilter() {
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;

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

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
    };
  }, []);

  return null;
}
