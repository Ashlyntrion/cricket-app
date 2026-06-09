import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { FeeStatusBadge } from './FeeStatusBadge';
import { Student, FeeStatus } from '../types';

interface StudentCardProps {
  student: Student;
  attendancePercentage?: number;
  feeStatus?: FeeStatus;
  onPress?: () => void;
}

export function StudentCard({ student, attendancePercentage, feeStatus, onPress }: StudentCardProps) {
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const attColor =
    attendancePercentage === undefined
      ? Colors.textLight
      : attendancePercentage >= 75
      ? Colors.success
      : attendancePercentage >= 50
      ? Colors.warning
      : Colors.danger;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
        <Text style={styles.batch} numberOfLines={1}>
          {student.batch?.name ?? 'No batch'} · {student.phone}
        </Text>
        {attendancePercentage !== undefined && (
          <View style={styles.attRow}>
            <Ionicons name="checkmark-circle" size={12} color={attColor} />
            <Text style={[styles.attText, { color: attColor }]}> {attendancePercentage}% attendance</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        {feeStatus && <FeeStatusBadge status={feeStatus} />}
        <Ionicons name="chevron-forward" size={16} color={Colors.textLight} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  info: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  batch: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attText: {
    fontSize: 11,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
