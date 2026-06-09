import React from 'react';
import { View } from 'react-native';
import Svg, {
  Path, Circle, Rect, Polygon, Ellipse,
  Text as SvgText, G, Defs, LinearGradient as SvgGradient, Stop, ClipPath,
} from 'react-native-svg';

interface CricketShieldProps {
  size?: number;
}

export function CricketShield({ size = 180 }: CricketShieldProps) {
  const scale = size / 220;
  const w = 220;
  const h = 240;

  return (
    <View style={{ width: size, height: size * (h / w) }}>
      <Svg width={size} height={size * (h / w)} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <SvgGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#f5c842" />
            <Stop offset="1" stopColor="#c88a00" />
          </SvgGradient>
          <SvgGradient id="ballGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#8b1a1a" />
            <Stop offset="1" stopColor="#5a0e0e" />
          </SvgGradient>
          <SvgGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0d2040" />
            <Stop offset="1" stopColor="#071428" />
          </SvgGradient>
        </Defs>

        {/* ── SHIELD outer gold shape ── */}
        <Path
          d="M 110 4 L 208 32 L 208 150 Q 208 208 110 236 Q 12 208 12 150 L 12 32 Z"
          fill="url(#goldGrad)"
        />
        {/* ── SHIELD dark navy fill (inset) ── */}
        <Path
          d="M 110 12 L 200 38 L 200 149 Q 200 203 110 228 Q 20 203 20 149 L 20 38 Z"
          fill="url(#navyGrad)"
        />
        {/* ── Inner gold border line ── */}
        <Path
          d="M 110 19 L 193 43 L 193 148 Q 193 198 110 222 Q 27 198 27 148 L 27 43 Z"
          fill="none"
          stroke="#f5c842"
          strokeWidth={1.5}
          opacity={0.6}
        />

        {/* ── GRASS / ground elements (gold curves at bottom of shield interior) ── */}
        <Path d="M 50 162 Q 65 152 72 158 Q 78 163 72 170" fill="none" stroke="#c88a00" strokeWidth={2.5} />
        <Path d="M 58 168 Q 68 155 78 162 Q 85 168 76 176" fill="none" stroke="#c88a00" strokeWidth={2} />
        <Path d="M 45 170 Q 55 158 62 165" fill="none" stroke="#c88a00" strokeWidth={2} />

        {/* ── CRICKET STUMPS (gold) ── */}
        <Rect x="128" y="140" width="4" height="28" rx="1" fill="#f5c842" />
        <Rect x="136" y="140" width="4" height="28" rx="1" fill="#f5c842" />
        <Rect x="144" y="140" width="4" height="28" rx="1" fill="#f5c842" />
        {/* bails */}
        <Rect x="127" y="139" width="22" height="2.5" rx="1" fill="#f5c842" />

        {/* ── CRICKET BALL ── */}
        <Circle cx="168" cy="100" r="16" fill="url(#ballGrad)" />
        {/* Seam curved line */}
        <Path d="M 158 92 Q 168 100 158 108" fill="none" stroke="white" strokeWidth={1.2} opacity={0.7} />
        <Path d="M 178 92 Q 168 100 178 108" fill="none" stroke="white" strokeWidth={1.2} opacity={0.7} />
        {/* Horizontal seam */}
        <Path d="M 154 100 L 182 100" fill="none" stroke="white" strokeWidth={0.8} opacity={0.5} />
        {/* Speed lines from ball */}
        <Path d="M 148 88 L 155 91" stroke="#f5c842" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
        <Path d="M 146 100 L 154 100" stroke="#f5c842" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
        <Path d="M 148 112 L 155 109" stroke="#f5c842" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />

        {/* ── BATSMAN SILHOUETTE (white) ── */}
        <G fill="white">
          {/* HEAD with helmet */}
          <Circle cx="92" cy="62" r="13" />
          {/* Helmet peak */}
          <Path d="M 80 58 Q 78 52 86 50 Q 96 48 102 55 L 104 58 Q 98 50 86 52 Z" fill="white" />
          {/* Face guard bars */}
          <Path d="M 81 60 L 84 70 M 84 58 L 87 69" fill="none" stroke="#0d2040" strokeWidth={1.5} opacity={0.4} />

          {/* TORSO — leaning slightly forward/left in batting stance */}
          <Path d="M 86 74 Q 80 78 76 95 Q 74 108 78 120 Q 88 126 98 122 Q 108 118 106 105 Q 108 90 102 78 Z" />

          {/* LEFT ARM — raised up holding bat grip */}
          <Path d="M 88 80 Q 82 72 74 60 Q 70 54 68 50 Q 72 46 76 52 Q 82 64 90 78 Z" />

          {/* RIGHT ARM — also raised, both hands on bat */}
          <Path d="M 98 78 Q 106 68 112 56 Q 116 50 114 46 Q 110 44 108 50 Q 104 60 96 76 Z" />

          {/* BAT — diagonal, going upper left */}
          <Path d="M 70 50 Q 65 44 48 28 Q 44 24 42 26 Q 40 30 44 34 Q 58 48 66 56 Z" fill="white" />
          {/* Bat handle */}
          <Rect x="63" y="42" width="5" height="22" rx="2" transform="rotate(-40, 65, 53)" fill="#e0e0e0" />

          {/* GLOVES */}
          <Ellipse cx="68" cy="50" rx="6" ry="5" />
          <Ellipse cx="112" cy="47" rx="6" ry="5" />

          {/* LEFT LEG — front leg, planted */}
          <Path d="M 82 120 Q 80 132 78 148 Q 76 156 80 158 Q 86 160 90 156 Q 94 152 92 144 Q 90 132 90 120 Z" />
          {/* Left pad */}
          <Path d="M 78 140 Q 76 152 80 158 Q 86 162 92 156 Q 96 150 92 142 Z" opacity={0.8} />

          {/* RIGHT LEG — back leg, slightly bent */}
          <Path d="M 98 120 Q 102 132 106 146 Q 108 154 104 158 Q 98 162 94 156 Q 90 152 92 146 Q 94 134 96 120 Z" />
          {/* Right pad */}
          <Path d="M 102 140 Q 106 150 104 158 Q 98 164 94 156 Q 90 152 92 146 Z" opacity={0.8} />

          {/* SHOES */}
          <Ellipse cx="83" cy="160" rx="10" ry="4" />
          <Ellipse cx="101" cy="160" rx="10" ry="4" />
        </G>

        {/* ── BOTTOM BANNER ── */}
        {/* Banner shape */}
        <Path
          d="M 22 175 Q 22 168 110 170 Q 198 168 198 175 L 198 205 Q 198 215 110 218 Q 22 215 22 205 Z"
          fill="url(#navyGrad)"
          stroke="#f5c842"
          strokeWidth={1.5}
        />
        {/* Banner side ribbons */}
        <Path d="M 22 175 L 10 182 L 22 190 Z" fill="#c88a00" />
        <Path d="M 198 175 L 210 182 L 198 190 Z" fill="#c88a00" />

        {/* CRICKET text */}
        <SvgText
          x="110"
          y="196"
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill="white"
          letterSpacing={1}
        >
          CRICKET
        </SvgText>

        {/* ACADEMY text */}
        <SvgText
          x="110"
          y="212"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#f5c842"
          letterSpacing={3}
        >
          — ACADEMY —
        </SvgText>

        {/* ── GOLD STAR at bottom ── */}
        <SvgText x="110" y="232" textAnchor="middle" fontSize="14" fill="#f5c842">
          ★
        </SvgText>
      </Svg>
    </View>
  );
}
