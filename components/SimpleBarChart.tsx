import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../constants/colors';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarData[];
  maxValue?: number;
  height?: number;
  unit?: string;
}

export function SimpleBarChart({ data, maxValue, height = 140, unit = '' }: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.container, { height: height + 32 }]}>
        {data.map((item, i) => {
          const barH = Math.max(4, (item.value / max) * height);
          return (
            <View key={i} style={styles.barWrapper}>
              <Text style={styles.valueLabel}>
                {item.value}{unit}
              </Text>
              <View style={[styles.barBg, { height }]}>
                <View
                  style={[
                    styles.bar,
                    { height: barH, backgroundColor: item.color ?? Colors.primary },
                  ]}
                />
              </View>
              <Text style={styles.xLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  barWrapper: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 36,
  },
  valueLabel: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 3,
  },
  barBg: {
    width: 28,
    justifyContent: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  xLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
});
