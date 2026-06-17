import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface WeekPoint { label: string; value: number }
interface Props { data: WeekPoint[]; width: number; height?: number }

export function WeeklyTrendChart({ data, width, height = 150 }: Props) {
  if (data.length < 2) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Not enough data yet</Text>
      </View>
    );
  }

  const pl = 36, pr = 12, pt = 14, pb = 30;
  const cw = width - pl - pr;
  const ch = height - pt - pb;

  const pts = data.map((d, i) => ({
    x: pl + (i / (data.length - 1)) * cw,
    y: pt + (1 - d.value / 100) * ch,
    v: d.value,
    lbl: d.label,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = pt + (1 - v / 100) * ch;
        return (
          <React.Fragment key={v}>
            <Line
              x1={pl} y1={y} x2={width - pr} y2={y}
              stroke={v === 75 ? Colors.warning : Colors.border}
              strokeWidth={v === 75 ? 1.5 : 1}
              strokeDasharray={v === 75 ? '5,3' : '2,3'}
            />
            <SvgText x={pl - 4} y={y + 4} fontSize={9} fill={Colors.textMuted} textAnchor="end">
              {v}%
            </SvgText>
          </React.Fragment>
        );
      })}

      <Polyline
        points={polyline}
        fill="none"
        stroke={Colors.primary}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {pts.map((p, i) => (
        <Circle
          key={i}
          cx={p.x} cy={p.y} r={5}
          fill={p.v >= 75 ? Colors.primary : Colors.danger}
          stroke="white" strokeWidth={2}
        />
      ))}

      {pts.map((p, i) => (
        <SvgText key={i} x={p.x} y={height - 6} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
          {p.lbl}
        </SvgText>
      ))}
    </Svg>
  );
}
