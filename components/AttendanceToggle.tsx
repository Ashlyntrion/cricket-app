import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { AttendanceStatus } from '../types';

interface AttendanceToggleProps {
  studentName: string;
  status: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
}

const options: { key: AttendanceStatus; label: string; bg: string; text: string }[] = [
  { key: 'present', label: 'P', bg: Colors.present, text: Colors.presentText },
  { key: 'late', label: 'L', bg: Colors.late, text: Colors.lateText },
  { key: 'absent', label: 'A', bg: Colors.absent, text: Colors.absentText },
];

export function AttendanceToggle({ studentName, status, onChange }: AttendanceToggleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>{studentName}</Text>
      <View style={styles.buttons}>
        {options.map((opt) => {
          const active = status === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.btn, active && { backgroundColor: opt.bg, borderColor: opt.text }]}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, active && { color: opt.text, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  btnText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '600',
  },
});
