import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { FeeStatusBadge } from '../../components/FeeStatusBadge';
import { SimpleBarChart } from '../../components/SimpleBarChart';
import { supabase } from '../../lib/supabase';
import { useAttendance } from '../../hooks/useAttendance';
import { useData } from '../../contexts/DataContext';
import { FeeStatus } from '../../types';

const STATUS_CONFIG = {
  present: { bg: Colors.present, text: Colors.presentText, icon: 'checkmark-circle' as const },
  absent: { bg: Colors.absent, text: Colors.absentText, icon: 'close-circle' as const },
  late: { bg: Colors.late, text: Colors.lateText, icon: 'time' as const },
};

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<any>(null);
  const [feePlan, setFeePlan] = useState<any>(null);
  const [feePayment, setFeePayment] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [attendancePct, setAttendancePct] = useState(0);
  const [monthlyAtt, setMonthlyAtt] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentStreak, setStudentStreak] = useState(0);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calData, setCalData] = useState<Record<string, string>>({});
  const [calLoading, setCalLoading] = useState(false);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBatch, setEditBatch] = useState('');
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editFeeDueDay, setEditFeeDueDay] = useState('25');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { getStudentAttendanceStats } = useAttendance();
  const { batches, refetchStudents } = useData();

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthStr = monthStr;

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);

    const [studentRes, planRes, paymentRes, attRes] = await Promise.all([
      supabase.from('students').select('*, batch:batches(*)').eq('id', id as string).single(),
      supabase.from('fee_plans').select('*').eq('student_id', id as string).single(),
      supabase.from('fee_payments').select('*').eq('student_id', id as string).eq('for_month', monthStr).single(),
      supabase.from('attendance').select('status, session:sessions(date)').eq('student_id', id as string).limit(20),
    ]);

    setStudent(studentRes.data);
    setFeePlan(planRes.data);
    setFeePayment(paymentRes.data);

    const sessions = ((attRes.data || []) as any[])
      .filter((r) => r.session?.date)
      .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime())
      .slice(0, 5)
      .map((r) => ({
        date: new Date(r.session.date).toLocaleDateString('en-IN', {
          weekday: 'short', day: 'numeric', month: 'short',
        }),
        status: r.status as keyof typeof STATUS_CONFIG,
      }));
    setRecentSessions(sessions);

    const thisMonthStats = await getStudentAttendanceStats(id as string, monthStr);
    setAttendancePct(thisMonthStats.percentage);

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      return d.toISOString().slice(0, 7);
    });
    const stats = await Promise.all(months.map((m) => getStudentAttendanceStats(id as string, m)));
    setMonthlyAtt(months.map((m, i) => ({
      label: new Date(`${m}-01`).toLocaleDateString('en-IN', { month: 'short' }),
      value: stats[i].percentage,
    })));

    // Student attendance streak: consecutive days present/late
    const { data: streakRecs } = await supabase
      .from('attendance')
      .select('session:sessions(date)')
      .eq('student_id', id as string)
      .in('status', ['present', 'late']);

    const allDates = (streakRecs || [])
      .map((r: any) => r.session?.date as string)
      .filter(Boolean);
    const unique = [...new Set(allDates)].sort().reverse();
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (unique.length === 0 || (unique[0] !== todayStr && unique[0] !== yesterdayStr)) {
      setStudentStreak(0);
    } else {
      let count = 1;
      for (let i = 1; i < unique.length; i++) {
        const expected = new Date(unique[i - 1]);
        expected.setDate(expected.getDate() - 1);
        if (unique[i] === expected.toISOString().slice(0, 10)) count++;
        else break;
      }
      setStudentStreak(count);
    }

    setLoading(false);
  };

  // Reload calendar when month changes or student loads
  useEffect(() => {
    if (!id || !student?.batch_id) return;
    loadCalendarData(calMonth, student.batch_id);
  }, [calMonth, student?.batch_id]);

  const loadCalendarData = async (month: string, batchId: string) => {
    setCalLoading(true);
    const [year, m] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Only sessions for this student's batch
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, date')
      .eq('batch_id', batchId)
      .gte('date', startDate)
      .lte('date', endDate);

    const sessionMap = new Map((sessions || []).map((s: any) => [s.id, s.date as string]));
    const sessionIds = [...sessionMap.keys()];

    // Mark all batch session days (will be overwritten if student has a record)
    const dayMap: Record<string, string> = {};
    sessionMap.forEach((date) => { dayMap[date] = 'session'; });

    if (sessionIds.length > 0) {
      const { data: attRecs } = await supabase
        .from('attendance')
        .select('status, session_id')
        .eq('student_id', id as string)
        .in('session_id', sessionIds);

      (attRecs || []).forEach((rec: any) => {
        const date = sessionMap.get(rec.session_id);
        if (date) dayMap[date] = rec.status;
      });
    }

    setCalData(dayMap);
    setCalLoading(false);
  };

  const openEdit = (s: any, plan: any) => {
    setEditName(s.name ?? '');
    setEditPhone(s.phone ?? '');
    setEditEmail(s.email ?? '');
    setEditBatch(s.batch_id ?? '');
    setEditFeeAmount(plan?.amount ? String(plan.amount) : '');
    setEditFeeDueDay(plan?.due_day ? String(plan.due_day) : '25');
    setShowEditModal(true);
  };

  const showMenu = () => setShowActionSheet(true);

  const confirmDelete = () => {
    const msg = `Remove ${student?.name} from the academy? Their attendance and fee history will be preserved but they will no longer appear in any list.`;
    if (Platform.OS === 'web') {
      if (confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete Student', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from('students')
      .update({ is_active: false })
      .eq('id', id as string);
    setDeleting(false);
    if (error) {
      Alert.alert('Error', 'Could not delete student. Please try again.');
      return;
    }
    refetchStudents();
    router.back();
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || editPhone.trim().length !== 10 || !editBatch) return;
    setSaving(true);

    const { error: studentError } = await supabase
      .from('students')
      .update({
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        batch_id: editBatch,
      })
      .eq('id', id as string);

    if (studentError) {
      setSaving(false);
      Alert.alert('Error', studentError.message);
      return;
    }

    if (editFeeAmount && parseInt(editFeeAmount, 10) > 0) {
      await supabase.from('fee_plans').upsert(
        {
          student_id: id,
          amount: parseInt(editFeeAmount, 10),
          frequency: 'monthly',
          due_day: parseInt(editFeeDueDay, 10) || 25,
        },
        { onConflict: 'student_id' }
      );
    }

    setSaving(false);
    setShowEditModal(false);
    refetchStudents();
    loadData();
  };

  const feeStatus: FeeStatus = (() => {
    if (!feePlan) return 'pending';
    if (feePayment) return 'paid';
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), feePlan.due_day);
    return today > dueDate ? 'overdue' : 'pending';
  })();

  const markFeePaid = async () => {
    if (!feePlan || feeStatus === 'paid') return;
    const { error } = await supabase.from('fee_payments').upsert(
      {
        student_id: id,
        amount: feePlan.amount,
        payment_date: new Date().toISOString().slice(0, 10),
        for_month: monthStr,
      },
      { onConflict: 'student_id,for_month' }
    );
    if (error) {
      Alert.alert('Error', 'Could not record payment. Please try again.');
    } else {
      setFeePayment({ student_id: id, for_month: monthStr });
    }
  };

  if (loading || deleting) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        {deleting && <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: 14 }}>Removing student…</Text>}
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Student Profile</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ionicons name="person-outline" size={48} color={Colors.textMuted} />
          <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>Student not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = student.name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const joinDate = student.join_date
    ? new Date(student.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const canSaveEdit = editName.trim().length > 0 && editPhone.trim().length === 10 && editBatch !== '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Student Profile</Text>
          <TouchableOpacity onPress={showMenu} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentBatch}>{student.batch?.name ?? ''}</Text>
          <View style={styles.profileRow}>
            <View style={styles.profileItem}>
              <Ionicons name="call" size={14} color={Colors.textSecondary} />
              <Text style={styles.profileItemText}>{student.phone}</Text>
            </View>
            {student.email ? (
              <>
                <View style={styles.divider} />
                <View style={styles.profileItem}>
                  <Ionicons name="mail" size={14} color={Colors.textSecondary} />
                  <Text style={styles.profileItemText}>{student.email}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.profileItem}>
              <Ionicons name="calendar" size={14} color={Colors.textSecondary} />
              <Text style={styles.profileItemText}>Joined {joinDate}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: attendancePct >= 75 ? Colors.success : Colors.danger }]}>
              {attendancePct > 0 ? `${attendancePct}%` : '--'}
            </Text>
            <Text style={styles.statLbl}>Attendance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>🔥 {studentStreak}</Text>
            <Text style={styles.statLbl}>Day Streak</Text>
          </View>
          <View style={styles.statBox}>
            <FeeStatusBadge status={feeStatus} />
            <Text style={styles.statLbl}>Fee Status</Text>
          </View>
        </View>

        {/* Attendance chart */}
        {monthlyAtt.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Trend</Text>
            <View style={{ marginTop: 12 }}>
              <SimpleBarChart data={monthlyAtt} maxValue={100} height={120} unit="%" />
            </View>
          </View>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Sessions</Text>
            {recentSessions.map((session, i) => {
              const cfg = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.present;
              return (
                <View
                  key={i}
                  style={[styles.sessionRow, i < recentSessions.length - 1 && styles.sessionBorder]}
                >
                  <Text style={styles.sessionDate}>{session.date}</Text>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={13} color={cfg.text} />
                    <Text style={[styles.statusText, { color: cfg.text }]}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Monthly Attendance Calendar */}
        <View style={styles.card}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              style={styles.calArrow}
              onPress={() => {
                const [y, m] = calMonth.split('-').map(Number);
                const prev = new Date(y, m - 2, 1);
                setCalMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
              }}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.calTitle}>
              {new Date(`${calMonth}-15`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={[styles.calArrow, calMonth >= currentMonthStr && { opacity: 0.3 }]}
              disabled={calMonth >= currentMonthStr}
              onPress={() => {
                const [y, m] = calMonth.split('-').map(Number);
                const next = new Date(y, m, 1);
                setCalMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
              }}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.calLegend}>
            {[
              { label: 'Present', color: Colors.present, textColor: Colors.presentText },
              { label: 'Absent', color: Colors.absent, textColor: Colors.absentText },
              { label: 'Late', color: Colors.late, textColor: Colors.lateText },
              { label: 'No record', color: Colors.background, textColor: Colors.textMuted, border: true },
            ].map((l) => (
              <View key={l.label} style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: l.color, borderWidth: l.border ? 1 : 0, borderColor: Colors.border }]} />
                <Text style={[styles.calLegendText, { color: l.textColor }]}>{l.label}</Text>
              </View>
            ))}
          </View>

          {/* Day headers */}
          <View style={styles.calDayHeaders}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={styles.calDayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {calLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (() => {
            const [year, m] = calMonth.split('-').map(Number);
            const firstDay = new Date(year, m - 1, 1);
            const daysInMonth = new Date(year, m, 0).getDate();
            const startOffset = (firstDay.getDay() + 6) % 7;
            const cells: (number | null)[] = [
              ...Array(startOffset).fill(null),
              ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
            ];
            // Pad to complete last row
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <View style={styles.calGrid}>
                {cells.map((day, i) => {
                  if (!day) return <View key={i} style={styles.calCell} />;
                  const dateStr = `${calMonth}-${String(day).padStart(2, '0')}`;
                  const status = calData[dateStr];
                  const isToday = dateStr === new Date().toISOString().slice(0, 10);
                  let bg = 'transparent';
                  let textColor = Colors.textSecondary;
                  let borderColor = 'transparent';
                  if (status === 'present') { bg = Colors.present; textColor = Colors.presentText; borderColor = Colors.presentBorder; }
                  else if (status === 'absent') { bg = Colors.absent; textColor = Colors.absentText; borderColor = Colors.absentBorder; }
                  else if (status === 'late') { bg = Colors.late; textColor = Colors.lateText; borderColor = Colors.lateBorder; }
                  else if (status === 'session') { bg = Colors.background; textColor = Colors.textMuted; borderColor = Colors.border; }

                  return (
                    <View key={i} style={styles.calCell}>
                      <View style={[
                        styles.calDayCircle,
                        { backgroundColor: bg, borderColor: isToday && !status ? Colors.primary : borderColor, borderWidth: isToday && !status ? 2 : (status ? 1 : 0) },
                      ]}>
                        <Text style={[styles.calDayNum, { color: isToday && !status ? Colors.primary : textColor, fontWeight: isToday ? '800' : '600' }]}>
                          {day}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>

        {/* Fee section */}
        <View style={[styles.card, { marginBottom: 32 }]}>
          <View style={styles.feeHeader}>
            <Text style={styles.cardTitle}>
              Fee — {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.feeAmt}>
              {feePlan ? `₹${feePlan.amount.toLocaleString()}` : '—'}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <FeeStatusBadge status={feeStatus} />
            {feeStatus !== 'paid' && feePlan && (
              <TouchableOpacity style={styles.payNowBtn} onPress={markFeePaid}>
                <Text style={styles.payNowText}>Mark as Paid</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Sheet — works on both native and web */}
      <Modal visible={showActionSheet} transparent animationType="slide" onRequestClose={() => setShowActionSheet(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.actionSheet}>
            <View style={styles.modalHandle} />
            <TouchableOpacity style={styles.actionRow} onPress={() => { setShowActionSheet(false); setTimeout(() => openEdit(student, feePlan), 200); }}>
              <Ionicons name="create-outline" size={20} color={Colors.text} />
              <Text style={styles.actionText}>Edit Student</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionRow} onPress={() => { setShowActionSheet(false); setTimeout(() => confirmDelete(), 200); }}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Delete Student</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionRow} onPress={() => setShowActionSheet(false)}>
              <Text style={[styles.actionText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Student</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                  {/* Basic Info */}
                  <Text style={styles.sectionLabel}>Basic Info</Text>

                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Full name"
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>

                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={editPhone}
                      onChangeText={setEditPhone}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Email (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={editEmail}
                      onChangeText={setEditEmail}
                      placeholder="student@email.com"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Batch */}
                  <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Batch *</Text>
                  {batches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.batchOption, editBatch === b.id && styles.batchOptionActive]}
                      onPress={() => setEditBatch(b.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.batchName, editBatch === b.id && styles.batchNameActive]}>
                          {b.name}
                        </Text>
                        {(b.schedule || b.time) ? (
                          <Text style={styles.batchTime}>
                            {[b.schedule, b.time].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {editBatch === b.id && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Fee Plan */}
                  <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Fee Plan</Text>

                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Monthly Fee (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={editFeeAmount}
                      onChangeText={setEditFeeAmount}
                      placeholder="e.g. 1500"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.modalField, { marginBottom: 8 }]}>
                    <Text style={styles.fieldLabel}>Due Date (day of month)</Text>
                    <TextInput
                      style={styles.input}
                      value={editFeeDueDay}
                      onChangeText={setEditFeeDueDay}
                      placeholder="e.g. 25"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[styles.saveBtn, !canSaveEdit && styles.saveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={!canSaveEdit || saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.text },
  menuBtn: { padding: 4 },
  profileCard: {
    backgroundColor: Colors.surface, margin: 16, borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  initials: { fontSize: 26, fontWeight: '700', color: Colors.primary },
  studentName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  studentBatch: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  profileItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileItemText: { fontSize: 13, color: Colors.textSecondary },
  divider: { width: 1, height: 14, backgroundColor: Colors.border },
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 6,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLbl: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 14, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  sessionBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  sessionDate: { fontSize: 13, color: Colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  feeAmt: { fontSize: 18, fontWeight: '700', color: Colors.text },
  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payNowBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  payNowText: { color: 'white', fontSize: 13, fontWeight: '600' },

  // Calendar
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calArrow: { padding: 6 },
  calTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 10, height: 10, borderRadius: 5 },
  calLegendText: { fontSize: 11, fontWeight: '500' },
  calDayHeaders: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: { width: (SCREEN_WIDTH - 32 - 32) / 7, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: (SCREEN_WIDTH - 32 - 32) / 7, alignItems: 'center', paddingVertical: 3 },
  calDayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { fontSize: 12 },

  // Action sheet
  actionSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 32,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 8 },
  actionText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  actionDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  modalField: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  batchOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  batchOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  batchName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  batchNameActive: { color: Colors.primary },
  batchTime: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
