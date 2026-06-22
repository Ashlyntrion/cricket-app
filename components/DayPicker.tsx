import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export function getTodayKey(): string {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
}

export function formatTrainingDays(days: string[]): string {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const labels: Record<string, string> = {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
  };
  return days
    .slice()
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((d) => labels[d] ?? d)
    .join(', ');
}

interface Props {
  selected: string[];
  onChange: (days: string[]) => void;
}

export function DayPicker({ selected, onChange }: Props) {
  const toggle = (day: string) => {
    onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
  };

  return (
    <View style={styles.row}>
      {DAYS.map((d) => {
        const active = selected.includes(d.key);
        return (
          <TouchableOpacity
            key={d.key}
            style={[styles.day, active && styles.dayActive]}
            onPress={() => toggle(d.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayText, active && styles.dayTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  day: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 8, backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  dayActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  dayText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  dayTextActive: { color: Colors.primary },
});
