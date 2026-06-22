import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { AttendanceStatus, Batch } from '../../types';
import { AppHeader } from '../../components/AppHeader';
import { useData } from '../../contexts/DataContext';
import { useAttendance } from '../../hooks/useAttendance';
import { getTodayKey, formatTrainingDays } from '../../components/DayPicker';

const { width } = Dimensions.get('window');

type StatusType = AttendanceStatus;
const STATUS_CYCLE: StatusType[] = ['present', 'late', 'absent'];

const STATUS_CONFIG = {
  present: { label: 'Present', bg: Colors.present, border: Colors.presentBorder, text: Colors.presentText },
  late: { label: 'Late', bg: Colors.late, border: Colors.lateBorder, text: Colors.lateText },
  absent: { label: 'Absent', bg: Colors.absent, border: Colors.absentBorder, text: Colors.absentText },
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function AttendanceScreen() {
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({});
  const [hasExistingSession, setHasExistingSession] = useState(true);
  const celebAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const { batches, batchLoading, students, studentLoading, isOnline, pendingSyncCount, syncNow } = useData();
  const { markAttendance, getAttendanceForSession, loading: attLoading } = useAttendance();

  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + dateOffset);
  const isoDate = displayDate.toISOString().slice(0, 10);
  const dateStr = displayDate.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });

  const todayKey = getTodayKey();

  // Auto-select a batch scheduled for today, else first batch
  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) {
      const scheduled = batches.find((b) => (b.training_days || []).includes(todayKey));
      setSelectedBatch(scheduled ?? batches[0]);
    }
  }, [batches]);

  // Load existing attendance and reset statuses when batch or date changes.
  // Depends on studentLoading (not students.length) so we wait for the full list before running.
  useEffect(() => {
    if (!selectedBatch || studentLoading) return;
    const batchStudents = students.filter((s) => s.batch_id === selectedBatch.id);

    const freshStatuses: Record<string, StatusType> = {};
    batchStudents.forEach((s) => { freshStatuses[s.id] = 'present'; });

    setSubmitted(false);
    celebAnim.setValue(0);
    progressAnim.setValue(0);

    if (dateOffset <= 0) {
      // Today: always allow entry. Past dates: only show if session exists.
      setHasExistingSession(dateOffset === 0);
      getAttendanceForSession(selectedBatch.id, isoDate).then((records) => {
        if (records.length > 0) {
          setHasExistingSession(true);
          records.forEach((r) => { freshStatuses[r.student_id] = r.status; });
        }
        setStatuses({ ...freshStatuses });
      });
    } else {
      setHasExistingSession(false);
      setStatuses(freshStatuses);
    }
  }, [selectedBatch?.id, dateOffset, studentLoading]);

  const batchStudents = students.filter((s) => s.batch_id === selectedBatch?.id);
  const total = batchStudents.length;
  const presentCount = batchStudents.filter((s) => statuses[s.id] === 'present').length;
  const lateCount = batchStudents.filter((s) => statuses[s.id] === 'late').length;
  const absentCount = batchStudents.filter((s) => statuses[s.id] === 'absent').length;
  const markedCount = presentCount + lateCount + absentCount;
  const progressPct = total > 0 ? Math.round((markedCount / total) * 100) : 0;

  const cycleStatus = (studentId: string) => {
    if (submitted) return;
    setStatuses((prev) => {
      const current = prev[studentId] ?? 'present';
      const idx = STATUS_CYCLE.indexOf(current);
      return { ...prev, [studentId]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
    });
  };

  const handleInningsComplete = async () => {
    if (!selectedBatch || batchStudents.length === 0 || dateOffset > 0) return;

    setSubmitted(true);
    Animated.spring(celebAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    Animated.timing(progressAnim, { toValue: 1, duration: 800, useNativeDriver: false }).start();

    const records = batchStudents.map((s) => ({
      student_id: s.id,
      status: statuses[s.id] ?? 'present',
    }));

    const result = await markAttendance(selectedBatch.id, isoDate, records);

    setTimeout(() => {
      if (result.queued) {
        Alert.alert(
          'Saved Offline 📴',
          `Attendance saved locally for ${selectedBatch.name}.\nWill sync automatically when you're back online.\n\nPresent: ${presentCount} · Late: ${lateCount} · Absent: ${absentCount}`,
          [{ text: 'Got it' }]
        );
      } else {
        Alert.alert(
          result.success ? 'Innings Complete! 🏏' : 'Save Failed',
          result.success
            ? `Session saved for ${selectedBatch.name}.\n\nPresent: ${presentCount} · Late: ${lateCount} · Absent: ${absentCount}`
            : 'Could not save attendance. Please try again.',
          [{
            text: result.success ? 'Great!' : 'OK',
            onPress: () => {
              if (!result.success) {
                setSubmitted(false);
                celebAnim.setValue(0);
                progressAnim.setValue(0);
              }
            },
          }]
        );
      }
    }, 1000);
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const celebScale = celebAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });
  const isLoading = batchLoading || (studentLoading && students.length === 0);

  return (
    <View style={styles.root}>
      <AppHeader title="Attendance" />

      {/* Offline / pending sync banners */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color="white" />
          <Text style={styles.offlineBannerText}>Offline — attendance will be saved locally</Text>
        </View>
      )}
      {isOnline && pendingSyncCount > 0 && (
        <TouchableOpacity style={styles.syncBanner} onPress={syncNow}>
          <Ionicons name="sync-outline" size={15} color={Colors.primary} />
          <Text style={styles.syncBannerText}>{pendingSyncCount} session{pendingSyncCount > 1 ? 's' : ''} pending sync — tap to sync now</Text>
        </TouchableOpacity>
      )}

      {/* Batch chips */}
      <View style={styles.batchRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.batchChips}>
          {batchLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />
          ) : (
            batches.map((b) => {
              const isToday = (b.training_days || []).includes(todayKey);
              const isActive = selectedBatch?.id === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.batchChip, isActive && styles.batchChipActive]}
                  onPress={() => setSelectedBatch(b)}
                >
                  {isToday && <View style={[styles.todayDot, isActive && { backgroundColor: 'white' }]} />}
                  <Text style={[styles.batchChipText, isActive && styles.batchChipTextActive]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Schedule info */}
      {selectedBatch && (
        <View style={styles.scheduleBar}>
          {(selectedBatch.training_days || []).length > 0 ? (
            <>
              {(selectedBatch.training_days || []).includes(todayKey) ? (
                <View style={styles.scheduledToday}>
                  <View style={styles.scheduledDot} />
                  <Text style={styles.scheduledTodayText}>Scheduled today · {formatTrainingDays(selectedBatch.training_days)}</Text>
                </View>
              ) : (
                <View style={styles.notScheduled}>
                  <Text style={styles.notScheduledText}>Not a training day · {formatTrainingDays(selectedBatch.training_days)}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noScheduleText}>No schedule set for this batch</Text>
          )}
        </View>
      )}

      {/* Date navigation */}
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => setDateOffset((d) => d - 1)}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dateArrow, dateOffset >= 0 && { opacity: 0.3 }]}
          onPress={() => dateOffset < 0 && setDateOffset((d) => d + 1)}
          disabled={dateOffset >= 0}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{markedCount} / {total} Marked</Text>
          <Text style={[styles.progressPct, { color: progressPct >= 90 ? Colors.primary : Colors.warning }]}>
            {progressPct}%
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          {submitted ? (
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          ) : (
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {dateOffset > 0 && (
            <View style={styles.noDataBanner}>
              <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.noDataText}>Cannot record future attendance</Text>
              <TouchableOpacity onPress={() => setDateOffset(0)}>
                <Text style={styles.noDataLink}>Go to today</Text>
              </TouchableOpacity>
            </View>
          )}
          {dateOffset < 0 && !hasExistingSession && batchStudents.length > 0 && (
            <View style={styles.newSessionNote}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.newSessionText}>No session saved for this date — set attendance and tap "Innings Complete" to create one</Text>
            </View>
          )}
          {!batchLoading && batches.length === 0 && (
            <View style={styles.noDataBanner}>
              <Text style={styles.noDataText}>No batches found. Add batches first.</Text>
            </View>
          )}
          <View style={styles.grid}>
            {dateOffset <= 0 && batchStudents.map((student) => {
              const status = statuses[student.id] ?? 'present';
              const cfg = STATUS_CONFIG[status];
              return (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.photoCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                  onPress={() => cycleStatus(student.id)}
                  activeOpacity={0.75}
                  disabled={submitted}
                >
                  <View style={[styles.photoAvatar, { borderColor: cfg.border }]}>
                    <Text style={[styles.photoInitials, { color: cfg.text }]}>{getInitials(student.name)}</Text>
                  </View>
                  <Text style={styles.photoName} numberOfLines={1}>{student.name}</Text>
                  <View style={[styles.statusPill, { backgroundColor: cfg.border + '30' }]}>
                    <Text style={[styles.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {!isLoading && (
        <View style={styles.footer}>
          {submitted && (
            <Animated.View style={[styles.celebBanner, { transform: [{ scale: celebScale }] }]}>
              <Text style={styles.celebText}>Innings complete! 🎉  Great job, Coach!</Text>
            </Animated.View>
          )}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryItem, { color: Colors.presentText }]}>● Present: {presentCount}</Text>
            <Text style={[styles.summaryItem, { color: Colors.absentText }]}>● Absent: {absentCount}</Text>
            <Text style={[styles.summaryItem, { color: Colors.lateText }]}>● Late: {lateCount}</Text>
          </View>
          <TouchableOpacity
            style={[styles.inningsBtn, (submitted || dateOffset > 0) && styles.inningsBtnDone]}
            onPress={handleInningsComplete}
            disabled={submitted || dateOffset > 0 || batchStudents.length === 0 || attLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.inningsBtnText}>
              {attLoading ? 'Saving… 🏏' : submitted ? 'Saved! 🏏' : !isOnline ? 'Save Offline 📴' : dateOffset < 0 ? (hasExistingSession ? 'Update Session 🏏' : 'Create Session 🏏') : 'Innings Complete! 🏏'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const CARD_W = (width - 14 * 2 - 10 * 2) / 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#555', paddingHorizontal: 14, paddingVertical: 8,
  },
  offlineBannerText: { fontSize: 13, color: 'white', fontWeight: '600', flex: 1 },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primarySurface, paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  syncBannerText: { fontSize: 13, color: Colors.primary, fontWeight: '600', flex: 1 },
  batchRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  batchChips: { gap: 8, paddingBottom: 4 },
  batchChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  batchChipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  batchChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  batchChipTextActive: { color: Colors.primary },
  todayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  scheduleBar: {
    paddingHorizontal: 14, paddingBottom: 6,
  },
  scheduledToday: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduledDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  scheduledTodayText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  notScheduled: {},
  notScheduledText: { fontSize: 12, color: Colors.warning, fontWeight: '600' },
  noScheduleText: { fontSize: 12, color: Colors.textMuted },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderTopWidth: 1, borderColor: Colors.border,
  },
  dateArrow: { padding: 6 },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  progressSection: { paddingHorizontal: 14, paddingVertical: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  progressPct: { fontSize: 15, fontWeight: '800' },
  progressBarBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 10 },
  photoCard: {
    width: CARD_W, borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 8, borderWidth: 1.5,
  },
  photoAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  photoInitials: { fontSize: 16, fontWeight: '800' },
  photoName: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  footer: {
    padding: 14, paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  celebBanner: {
    backgroundColor: Colors.primarySurface, borderRadius: 10,
    padding: 10, alignItems: 'center', marginBottom: 10,
  },
  celebText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 10 },
  summaryItem: { fontSize: 13, fontWeight: '600' },
  inningsBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  inningsBtnDone: { backgroundColor: Colors.primaryDark },
  inningsBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  noDataBanner: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  noDataText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  noDataLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  newSessionNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  newSessionText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
