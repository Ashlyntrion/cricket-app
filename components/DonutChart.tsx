import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Slice {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  data: Slice[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
  showLegend?: boolean;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 360) end = 359.999;
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export function DonutChart({ data, size = 160, centerLabel, centerSub, showLegend = true }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;

  let angle = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * 360;
      const path = arcPath(cx, cy, r, angle, angle + sweep);
      angle += sweep;
      return { ...d, path };
    });

  const svgEl = (
    <View style={{ position: 'relative', width: size, height: size }}>
      <Svg width={size} height={size}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} />
        ))}
        <Circle cx={cx} cy={cy} r={r * 0.58} fill="white" />
      </Svg>
      {(centerLabel || centerSub) && (
        <View style={[styles.center, { width: r * 1.16, height: r * 1.16, borderRadius: r * 0.58, top: cx - r * 0.58, left: cx - r * 0.58 }]}>
          {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
          {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
        </View>
      )}
    </View>
  );

  if (!showLegend) return svgEl;

  return (
    <View style={styles.wrapper}>
      {svgEl}
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel}>{d.label}</Text>
            <Text style={styles.legendValue}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  centerSub: { fontSize: 10, color: '#6b7280' },
  legend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: '#6b7280' },
  legendValue: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
});
