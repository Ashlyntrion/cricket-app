import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FeeStatus } from '../types';

interface FeeStatusBadgeProps {
  status: FeeStatus;
  small?: boolean;
}

const config: Record<FeeStatus, { bg: string; text: string; label: string }> = {
  paid: { bg: Colors.paid, text: Colors.paidText, label: 'Paid' },
  pending: { bg: Colors.pending, text: Colors.pendingText, label: 'Pending' },
  overdue: { bg: Colors.overdue, text: Colors.overdueText, label: 'Overdue' },
};

export function FeeStatusBadge({ status, small }: FeeStatusBadgeProps) {
  const { bg, text, label } = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.text, { color: text }, small && styles.smallText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
  },
});
