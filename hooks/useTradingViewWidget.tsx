'use client';

import { useEffect, useMemo, useRef } from 'react';

const useTradingViewWidget = (
  scriptUrl: string,
  config: Record<string, unknown>,
  height = 600,
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;
    if (container.dataset.loaded) return;

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.width = '100%';
    widget.style.height = `${height}px`;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptUrl;
    script.async = true;
    script.textContent = serializedConfig;

    container.append(widget, script);
    container.dataset.loaded = 'true';

    return () => {
      container.innerHTML = '';
      delete container.dataset.loaded;
    };
  }, [scriptUrl, serializedConfig, height]);

  return containerRef;
};

export default useTradingViewWidget;
