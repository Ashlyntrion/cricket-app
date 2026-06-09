import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { CircularProgress } from '../../components/CircularProgress';
import { AppHeader } from '../../components/AppHeader';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function getRingColor(pct: number) {
  if (pct >= 85) return Colors.primary;
  if (pct >= 70) return Colors.warning;
  return Colors.danger;
}

export default function StudentsScreen() {
  const [search, setSearch] = useState('');
  const [activeBatch, setActiveBatch] = useState('all');
  const [attendanceStats, setAttendanceStats] = useState<Record<string, number>>({});

  const { batches, students, studentLoading: loading } = useData();

  useEffect(() => {
    const monthStr = new Date().toISOString().slice(0, 7);
    const startDate = `${monthStr}-01`;
    const [year, month] = monthStr.split('-').map(Number);
    const endDate = `${monthStr}-${new Date(year, month, 0).getDate()}`;

    // Step 1: get session IDs in this month
    supabase
      .from('sessions')
      .select('id')
      .gte('date', startDate)
      .lte('date', endDate)
      .then(async ({ data: sessions }) => {
        const sessionIds = (sessions || []).map((s: any) => s.id);
        if (sessionIds.length === 0) return;

        // Step 2: get all attendance for those sessions
        const { data } = await supabase
          .from('attendance')
          .select('student_id, status, session_id')
          .in('session_id', sessionIds);

        if (!data) return;
        const raw: Record<string, { attended: number; total: number }> = {};
        data.forEach((att: any) => {
          if (!raw[att.student_id]) raw[att.student_id] = { attended: 0, total: 0 };
          raw[att.student_id].total++;
          if (att.status === 'present' || att.status === 'late') raw[att.student_id].attended++;
        });
        const pcts: Record<string, number> = {};
        Object.entries(raw).forEach(([id, s]) => {
          pcts[id] = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
        });
        setAttendanceStats(pcts);
      });
  }, [students.length]);

  const batchList = [{ id: 'all', name: 'All Batches' }, ...batches.map((b) => ({ id: b.id, name: b.name }))];

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchBatch = activeBatch === 'all' || s.batch_id === activeBatch;
    return matchSearch && matchBatch;
  });

  return (
    <View style={styles.root}>
      <AppHeader title="Students" />

      <TouchableOpacity style={styles.addStudentBtn} onPress={() => router.push('/add-student')}>
        <Ionicons name="add" size={18} color="white" />
        <Text style={styles.addStudentText}>Add Student</Text>
      </TouchableOpacity>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
        {batchList.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.chip, activeBatch === b.id && styles.chipActive]}
            onPress={() => setActiveBatch(b.id)}
          >
            <Text style={[styles.chipText, activeBatch === b.id && styles.chipTextActive]}>{b.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {search ? 'No students match your search' : 'No students yet'}
              </Text>
              {!search && (
                <TouchableOpacity onPress={() => router.push('/add-student')}>
                  <Text style={styles.emptyLink}>Add your first student</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const pct = attendanceStats[item.id] ?? 0;
            const color = pct > 0 ? getRingColor(pct) : Colors.border;
            return (
              <TouchableOpacity
                style={styles.studentCard}
                onPress={() => router.push(`/student/${item.id}`)}
                activeOpacity={0.75}
              >
                <CircularProgress percentage={pct} size={58} strokeWidth={3} color={color} trackColor={Colors.border}>
                  <View style={styles.avatarInner}>
                    <Text style={styles.initials}>{getInitials(item.name)}</Text>
                  </View>
                </CircularProgress>

                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <View style={styles.batchTag}>
                    <Ionicons name="person" size={11} color={Colors.textMuted} />
                    <Text style={styles.batchText}>{item.batch?.name ?? ''}</Text>
                  </View>
                </View>

                <View style={styles.attRight}>
                  <Text style={[styles.attPct, { color: pct > 0 ? color : Colors.textMuted }]}>
                    {pct > 0 ? `${pct}%` : '--'}
                  </Text>
                  <Text style={styles.attLabel}>Attendance</Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  addStudentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    margin: 14, marginBottom: 4, alignSelf: 'flex-end',
  },
  addStudentText: { color: 'white', fontSize: 13, fontWeight: '700' },
  searchRow: { padding: 14, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  chipsScroll: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  emptyLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  listContent: { paddingHorizontal: 14, paddingBottom: 20 },
  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  avatarInner: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontSize: 15, fontWeight: '700', color: Colors.text },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 5 },
  batchTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batchText: { fontSize: 12, color: Colors.textSecondary },
  attRight: { alignItems: 'center' },
  attPct: { fontSize: 18, fontWeight: '800' },
  attLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
});
