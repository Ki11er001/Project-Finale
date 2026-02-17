'use client';
import { useEffect, useMemo, useRef } from "react";

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;
        if (container.dataset.loaded) return;
        container.innerHTML = `
          <div class="tradingview-widget-container__widget" style="width: 100%; height: ${height}px;"></div>
          <script type="text/javascript" src="${scriptUrl}" async>
            ${serializedConfig}
          </script>
        `;
        container.dataset.loaded = 'true';

        return () => {
            container.innerHTML = '';
            delete container.dataset.loaded;
        }
    }, [scriptUrl, serializedConfig, height])

    return containerRef;
}
export default useTradingViewWidget
