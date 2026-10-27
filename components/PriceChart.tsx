import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Circle } from 'react-native-svg';

import { Colors } from '@/constants/Colors';
import { getFx } from '@/lib/currency';
import { formatNumber } from '@/lib/format';
import type { Candle, ChartData, LinePoint, Range } from '@/services/coinService';

export interface ScrubPoint {
  t: number;
  /** Close (candles) or price (line). */
  v: number;
  candle?: Candle;
}

interface Props {
  data: ChartData;
  range: Range | 'ALL';
  height?: number;
  positive: boolean;
  onScrub?: (p: ScrubPoint | null) => void;
}

const AXIS_W = 68;
const TOP = 22;
const BOTTOM = 26;

/** Axis numbers in the display currency (input USD), Delta typography. */
function niceNumber(usd: number): string {
  const v = usd * getFx().rate;
  const abs = Math.abs(v);
  const digits = abs === 0 || abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return formatNumber(v, digits, digits);
}

function dateLabel(t: number, range: Range | 'ALL', spanMs = Infinity): string {
  const d = new Date(t);
  if (range === '1D' || spanMs < 2 * 86_400_000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export function PriceChart({ data, range, height = 260, positive, onScrub }: Props) {
  const [width, setWidth] = useState(0);
  const [scrubX, setScrubX] = useState<number | null>(null);

  const series = useMemo(() => {
    if (data.type === 'line') {
      return data.points.map((p) => ({ t: p.t, v: p.v, lo: p.v, hi: p.v }));
    }
    return data.candles.map((c) => ({ t: c.t, v: c.c, lo: c.l, hi: c.h, candle: c }));
  }, [data]);

  const plotW = Math.max(0, width - AXIS_W);
  const plotH = height - TOP - BOTTOM;

  const geo = useMemo(() => {
    if (series.length < 2 || plotW <= 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      if (s.lo < min) min = s.lo;
      if (s.hi > max) max = s.hi;
    }
    if (min === max) {
      min *= 0.99;
      max *= 1.01;
    }
    const pad = (max - min) * 0.06;
    const lo = min - pad;
    const hi = max + pad;
    const t0 = series[0].t;
    const t1 = series[series.length - 1].t;
    const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * plotW;
    const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
    return { min, max, lo, hi, t0, t1, x, y };
  }, [series, plotW, plotH]);

  const color = positive ? Colors.green : Colors.red;

  const linePath = useMemo(() => {
    if (!geo || data.type !== 'line') return { line: '', area: '' };
    let d = '';
    (data.points as LinePoint[]).forEach((p, i) => {
      d += `${i === 0 ? 'M' : 'L'}${geo.x(p.t).toFixed(1)},${geo.y(p.v).toFixed(1)}`;
    });
    const area = `${d}L${plotW.toFixed(1)},${(TOP + plotH).toFixed(1)}L0,${(TOP + plotH).toFixed(1)}Z`;
    return { line: d, area };
  }, [geo, data, plotW, plotH]);

  const scrubIndex = useMemo(() => {
    if (scrubX === null || !geo || series.length === 0) return null;
    const t = geo.t0 + (Math.min(Math.max(scrubX, 0), plotW) / Math.max(1, plotW)) * (geo.t1 - geo.t0);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < series.length; i++) {
      const dist = Math.abs(series[i].t - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }, [scrubX, geo, series, plotW]);

  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const seriesRef = useRef(series);
  seriesRef.current = series;
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const plotWRef = useRef(plotW);
  plotWRef.current = plotW;

  const emit = (x: number) => {
    const g = geoRef.current;
    const s = seriesRef.current;
    if (!g || s.length === 0) return;
    const t = g.t0 + (Math.min(Math.max(x, 0), plotWRef.current) / Math.max(1, plotWRef.current)) * (g.t1 - g.t0);
    let best = s[0];
    for (const p of s) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    onScrubRef.current?.({ t: best.t, v: best.v, candle: 'candle' in best ? (best as { candle?: Candle }).candle : undefined });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        setScrubX(e.nativeEvent.locationX);
        emit(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => {
        setScrubX(e.nativeEvent.locationX);
        emit(e.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setScrubX(null);
        onScrubRef.current?.(null);
      },
      onPanResponderTerminate: () => {
        setScrubX(null);
        onScrubRef.current?.(null);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const ticks = useMemo(() => {
    if (!geo) return [];
    const n = 4;
    return Array.from({ length: n }, (_, i) => geo.lo + ((geo.hi - geo.lo) * (i + 0.5)) / n);
  }, [geo]);

  const xLabels = useMemo(() => {
    if (!geo) return [];
    const n = 4;
    return Array.from({ length: n }, (_, i) => {
      const t = geo.t0 + ((geo.t1 - geo.t0) * (i + 0.5)) / n;
      return { x: geo.x(t), label: dateLabel(t, range, geo.t1 - geo.t0) };
    });
  }, [geo, range]);

  const sel = scrubIndex !== null ? series[scrubIndex] : null;

  return (
    <View style={{ height }} onLayout={onLayout}>
      {geo && width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* max / min reference lines */}
            {[geo.max, geo.min].map((v, i) => (
              <Line
                key={i}
                x1={0}
                x2={plotW}
                y1={geo.y(v)}
                y2={geo.y(v)}
                stroke="rgba(255,255,255,0.28)"
                strokeDasharray="3,4"
                strokeWidth={1}
              />
            ))}

            {data.type === 'line' ? (
              <>
                <Path d={linePath.area} fill="url(#fill)" />
                <Path d={linePath.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
              </>
            ) : (
              (data.candles as Candle[]).map((c, i) => {
                const n = data.candles.length;
                const bodyW = Math.max(1.5, Math.min(10, (plotW / n) * 0.62));
                const cx = geo.x(c.t);
                const up = c.c >= c.o;
                const col = up ? Colors.green : Colors.red;
                const yTop = geo.y(Math.max(c.o, c.c));
                const yBot = geo.y(Math.min(c.o, c.c));
                return (
                  <React.Fragment key={i}>
                    <Line x1={cx} x2={cx} y1={geo.y(c.h)} y2={geo.y(c.l)} stroke={col} strokeWidth={1} />
                    <Rect
                      x={cx - bodyW / 2}
                      y={yTop}
                      width={bodyW}
                      height={Math.max(1, yBot - yTop)}
                      fill={col}
                    />
                  </React.Fragment>
                );
              })
            )}

            {/* axis baseline */}
            <Line x1={0} x2={plotW} y1={TOP + plotH} y2={TOP + plotH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

            {sel && (
              <>
                <Line
                  x1={geo.x(sel.t)}
                  x2={geo.x(sel.t)}
                  y1={TOP}
                  y2={TOP + plotH}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1}
                />
                <Circle cx={geo.x(sel.t)} cy={geo.y(sel.v)} r={4.5} fill={Colors.text} stroke={color} strokeWidth={2} />
              </>
            )}
          </Svg>

          {/* Labels as RN text for crisp rendering */}
          <Text style={[styles.refLabel, { top: geo.y(geo.max) - 17 }]}>
            {getFx().symbol}
            {niceNumber(geo.max)}
          </Text>
          <Text style={[styles.refLabel, { top: geo.y(geo.min) + 3 }]}>
            {getFx().symbol}
            {niceNumber(geo.min)}
          </Text>
          {ticks.map((v, i) => (
            <Text key={i} style={[styles.yLabel, { top: geo.y(v) - 8 }]} numberOfLines={1}>
              {niceNumber(v)}
            </Text>
          ))}
          {xLabels.map((l, i) => (
            <Text key={i} style={[styles.xLabel, { left: Math.max(0, Math.min(plotW - 60, l.x - 30)) }]} numberOfLines={1}>
              {l.label}
            </Text>
          ))}

          {/* Touch layer limited to the plot area */}
          <View style={[styles.touch, { width: plotW, height }]} {...responder.panHandlers} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  refLabel: {
    position: 'absolute',
    left: 2,
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  yLabel: {
    position: 'absolute',
    right: 0,
    width: AXIS_W - 6,
    textAlign: 'right',
    color: Colors.textTertiary,
    fontSize: 10,
  },
  xLabel: {
    position: 'absolute',
    bottom: 4,
    width: 60,
    textAlign: 'center',
    color: Colors.textTertiary,
    fontSize: 10,
  },
  touch: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
