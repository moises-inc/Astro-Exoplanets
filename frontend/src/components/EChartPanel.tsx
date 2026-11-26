import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface EChartPanelProps {
  option: EChartsOption;
  alt: string;
  height?: number;
  title?: string;
  onSelectPlanet?: (plName: string) => void;
}

export function EChartPanel({
  option,
  alt,
  height = 420,
  title,
  onSelectPlanet,
}: EChartPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const onSelectRef = useRef(onSelectPlanet);
  onSelectRef.current = onSelectPlanet;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    instanceRef.current = chart;

    chart.on('click', (params: unknown) => {
      const cb = onSelectRef.current;
      if (!cb) return;
      const p = params as { data?: { plName?: unknown }; name?: unknown };
      if (p?.data && typeof p.data.plName === 'string' && p.data.plName.trim()) {
        cb(p.data.plName.trim());
        return;
      }
      if (typeof p?.name === 'string' && p.name.trim()) {
        cb(p.name.trim());
      }
    });

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [option]);

  return (
    <div className="exo-chart-panel">
      {title ? (
        <div className="chart-panel-header">
          <h4 className="subsection-heading">{title}</h4>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className="chart-host"
        style={{ height: `${height}px` }}
        role="img"
        aria-label={alt}
      />
    </div>
  );
}
