import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { DonutChart } from '../../components/DonutChart';
import { AppHeader } from '../../components/AppHeader';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { getTodayKey } from '../../components/DayPicker';

const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

interface TodayStats { present: number; absent: number; late: number }
interface FeeStats { collected: number; outstanding: number }
interface NeedsAttention { id: string; name: string; msg: string; type: string }
interface BatchStat { id: string; name: string; pct: number }

export default function DashboardScreen() {
  const [todayStats, setTodayStats] = useState<TodayStats>({ present: 0, absent: 0, late: 0 });
  const [feeStats, setFeeStats] = useState<FeeStats>({ collected: 0, outstanding: 0 });
  const [needsAttention, setNeedsAttention] = useState<NeedsAttention[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStat[]>([]);
  const [todayBatches, setTodayBatches] = useState<{ id: string; name: string; marked: boolean }[]>([]);
  const [streak, setStreak] = useState(0);

  const { students, batches } = useData();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    // Attendance streak: consecutive days with at least one session marked
    supabase
      .from('sessions')
      .select('date')
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setStreak(0); return; }
        const unique = [...new Set(data.map((s: any) => s.date as string))].sort().reverse();
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (unique[0] !== today && unique[0] !== yesterday) { setStreak(0); return; }
        let count = 1;
        for (let i = 1; i < unique.length; i++) {
          const expected = new Date(unique[i - 1]);
          expected.setDate(expected.getDate() - 1);
          if (unique[i] === expected.toISOString().slice(0, 10)) count++;
          else break;
        }
        setStreak(count);
      });

    // Today's attendance across all batches
    supabase
      .from('sessions')
      .select('id, attendance(status)')
      .eq('date', today)
      .then(({ data }) => {
        if (!data) return;
        let present = 0, absent = 0, late = 0;
        data.forEach((s: any) => {
          (s.attendance as any[]).forEach((a) => {
            if (a.status === 'present') present++;
            else if (a.status === 'absent') absent++;
            else if (a.status === 'late') late++;
          });
        });
        setTodayStats({ present, absent, late });
      });

    // Fee stats: collected vs outstanding
    Promise.all([
      supabase.from('fee_payments').select('amount').eq('for_month', monthStr),
      supabase.from('fee_plans').select('amount, student_id'),
      supabase.from('fee_payments').select('student_id').eq('for_month', monthStr),
    ]).then(([paymentsRes, plansRes, paidRes]) => {
      const payments = (paymentsRes.data || []) as any[];
      const plans = (plansRes.data || []) as any[];
      const paidIds = new Set((paidRes.data || []).map((p: any) => p.student_id));
      const collected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const outstanding = plans
        .filter((p) => !paidIds.has(p.student_id))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      setFeeStats({ collected, outstanding });
    });

    // Needs attention: fee overdue + low attendance (< 75%)
    const now2 = new Date();
    const monthEnd = `${monthStr}-${new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate()}`;
    Promise.all([
      supabase.from('students').select('id, name').eq('is_active', true),
      supabase.from('fee_plans').select('student_id, due_day, amount'),
      supabase.from('fee_payments').select('student_id').eq('for_month', monthStr),
      supabase.from('sessions').select('id').gte('date', `${monthStr}-01`).lte('date', monthEnd),
    ]).then(async ([studentRes, plansRes, paidRes, sessionsRes]) => {
      const studentList = (studentRes.data || []) as any[];
      const planMap = new Map((plansRes.data || []).map((p: any) => [p.student_id, p]));
      const paidSet = new Set((paidRes.data || []).map((p: any) => p.student_id));
      const now3 = new Date();

      const feeAlerts: NeedsAttention[] = studentList
        .filter((s) => {
          if (paidSet.has(s.id)) return false;
          const plan = planMap.get(s.id);
          if (!plan) return false;
          return now3 > new Date(now3.getFullYear(), now3.getMonth(), plan.due_day);
        })
        .map((s) => {
          const plan = planMap.get(s.id);
          const dueDate = new Date(now3.getFullYear(), now3.getMonth(), plan.due_day);
          const days = Math.floor((now3.getTime() - dueDate.getTime()) / 86400000);
          return { id: s.id, name: s.name, msg: `${days}d overdue on fee`, type: 'fee' };
        });

      const sessionIds = (sessionsRes.data || []).map((s: any) => s.id);
      let attAlerts: NeedsAttention[] = [];
      if (sessionIds.length > 0) {
        const { data: allAtt } = await supabase
          .from('attendance').select('student_id, status').in('session_id', sessionIds);
        const attMap: Record<string, { attended: number; total: number }> = {};
        (allAtt || []).forEach((a: any) => {
          if (!attMap[a.student_id]) attMap[a.student_id] = { attended: 0, total: 0 };
          attMap[a.student_id].total++;
          if (a.status === 'present' || a.status === 'late') attMap[a.student_id].attended++;
        });
        attAlerts = studentList
          .filter((s) => {
            const stat = attMap[s.id];
            return stat && stat.total > 0 && Math.round((stat.attended / stat.total) * 100) < 75;
          })
          .map((s) => {
            const stat = attMap[s.id];
            const pct = Math.round((stat.attended / stat.total) * 100);
            return { id: s.id, name: s.name, msg: `${pct}% attendance this month`, type: 'attendance' };
          });
      }

      const seen = new Set<string>();
      const combined = [...feeAlerts, ...attAlerts].filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      }).slice(0, 6);
      setNeedsAttention(combined);
    });
  }, [students.length]);

  // Today's scheduled batches + whether attendance is marked
  useEffect(() => {
    if (batches.length === 0) return;
    const todayKey = getTodayKey();
    const scheduled = batches.filter((b) => (b.training_days || []).includes(todayKey));
    if (scheduled.length === 0) { setTodayBatches([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('sessions').select('batch_id').eq('date', today).then(({ data }) => {
      const marked = new Set((data || []).map((s: any) => s.batch_id));
      setTodayBatches(scheduled.map((b) => ({ id: b.id, name: b.name, marked: marked.has(b.id) })));
    });
  }, [batches.length]);

  // Batch performance stats
  useEffect(() => {
    if (batches.length === 0) return;
    const now = new Date();
    const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const me = `${ms}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
    supabase.from('sessions').select('id, batch_id').gte('date', `${ms}-01`).lte('date', me)
      .then(async ({ data: sessions }) => {
        if (!sessions || sessions.length === 0) return;
        const sessionIds = sessions.map((s: any) => s.id);
        const { data: allAtt } = await supabase
          .from('attendance').select('session_id, status').in('session_id', sessionIds);
        const sessionBatchMap = new Map((sessions as any[]).map((s) => [s.id, s.batch_id]));
        const batchAtt: Record<string, { attended: number; total: number }> = {};
        (allAtt || []).forEach((a: any) => {
          const bid = sessionBatchMap.get(a.session_id);
          if (!bid) return;
          if (!batchAtt[bid]) batchAtt[bid] = { attended: 0, total: 0 };
          batchAtt[bid].total++;
          if (a.status === 'present' || a.status === 'late') batchAtt[bid].attended++;
        });
        setBatchStats(
          batches
            .map((b) => {
              const s = batchAtt[b.id];
              if (!s || s.total === 0) return null;
              return { id: b.id, name: b.name, pct: Math.round((s.attended / s.total) * 100) };
            })
            .filter(Boolean) as BatchStat[]
        );
      });
  }, [batches.length]);

  const totalFees = feeStats.collected + feeStats.outstanding;
  const collectedPct = totalFees > 0 ? Math.round((feeStats.collected / totalFees) * 100) : 0;
  const hasFeData = totalFees > 0;

  const feeDonut = hasFeData
    ? [
        { value: feeStats.collected, color: Colors.primary, label: 'Collected' },
        { value: feeStats.outstanding, color: Colors.warning, label: 'Outstanding' },
      ]
    : [{ value: 1, color: Colors.border, label: 'No data' }];

  return (
    <View style={styles.root}>
      <AppHeader title="Dashboard" />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingText}>{greeting}, Coach! 🏏</Text>
          <Text style={styles.greetingSub}>Here's what's happening today.</Text>
        </View>

        {/* Streak card */}
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <View style={styles.streakLabelRow}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.streakLabel}>Your Streak</Text>
            </View>
            <Text style={styles.streakDays}>{streak} {streak === 1 ? 'Day' : 'Days'}</Text>
            <Text style={styles.streakKeep}>{streak > 0 ? 'Keep it up!' : 'Start today!'}</Text>
          </View>
          <LinearGradient colors={['#f59e0b', '#d97706', '#b45309']} style={styles.streakBall}>
            <Text style={styles.streakNum}>{streak}</Text>
          </LinearGradient>
        </View>

        {/* Today stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Present Today', value: String(todayStats.present), icon: 'people', color: Colors.primary },
            { label: 'Absent Today', value: String(todayStats.absent), icon: 'close-circle', color: Colors.danger },
            { label: 'Late Today', value: String(todayStats.late), icon: 'time', color: Colors.warning },
          ].map((s) => (
            <TouchableOpacity
              key={s.label}
              style={styles.statCard}
              onPress={() => router.push('/(tabs)/attendance')}
              activeOpacity={0.8}
            >
              <Ionicons name={s.icon as any} size={20} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fee overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fees Overview (This Month)</Text>
          {!hasFeData ? (
            <View style={styles.noFeeData}>
              <Ionicons name="wallet-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.noFeeText}>No fee records this month</Text>
              <Text style={styles.noFeeSub}>Add students with fee plans to get started</Text>
            </View>
          ) : (
            <>
              <View style={styles.donutRow}>
                <DonutChart
                  data={feeDonut}
                  size={140}
                  centerLabel={`${collectedPct}%`}
                  centerSub="collected"
                  showLegend={false}
                />
                <View style={styles.feeLegend}>
                  {[
                    { label: 'Collected', amt: `₹${feeStats.collected.toLocaleString()}`, color: Colors.primary },
                    { label: 'Outstanding', amt: `₹${feeStats.outstanding.toLocaleString()}`, color: Colors.warning },
                  ].map((f) => (
                    <View key={f.label} style={styles.feeLegendRow}>
                      <View style={[styles.feeDot, { backgroundColor: f.color }]} />
                      <View>
                        <Text style={[styles.feeAmt, { color: f.color }]}>{f.amt}</Text>
                        <Text style={styles.feeLbl}>{f.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.collectedBanner}>
                <View>
                  <Text style={styles.collectedAmt}>₹{feeStats.collected.toLocaleString()}</Text>
                  <Text style={styles.collectedSub}>Collected This Month</Text>
                </View>
                <View style={styles.trendChip}>
                  <Ionicons name="trending-up" size={13} color={Colors.primary} />
                  <Text style={styles.trendText}>{collectedPct}% collected</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Training Today */}
        {todayBatches.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Training Today</Text>
            {todayBatches.map((b, i) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.todayBatchRow, i < todayBatches.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
                onPress={() => router.push('/(tabs)/attendance')}
                activeOpacity={0.7}
              >
                <View style={[styles.todayDot, { backgroundColor: b.marked ? Colors.primary : Colors.warning }]} />
                <Text style={styles.todayBatchName}>{b.name}</Text>
                <View style={[styles.todayBadge, { backgroundColor: b.marked ? Colors.primarySurface : Colors.accentSurface }]}>
                  <Text style={[styles.todayBadgeText, { color: b.marked ? Colors.primary : Colors.warning }]}>
                    {b.marked ? 'Marked ✓' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Mark attendance CTA */}
        <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/(tabs)/attendance')} activeOpacity={0.85}>
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIcon}>
              <Ionicons name="calendar" size={22} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.ctaTitle}>Mark Today's Attendance</Text>
              <Text style={styles.ctaSub}>Tap to record today's session</Text>
            </View>
          </View>
          <View style={styles.ctaArrow}>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </View>
        </TouchableOpacity>

        {/* Batch Performance */}
        {batchStats.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Batch Performance (This Month)</Text>
            {batchStats.map((b) => (
              <View key={b.id} style={styles.batchRow}>
                <Text style={styles.batchName}>{b.name}</Text>
                <View style={styles.batchBarWrap}>
                  <View style={[styles.batchBarFill, {
                    width: `${b.pct}%` as any,
                    backgroundColor: b.pct >= 75 ? Colors.primary : b.pct >= 50 ? Colors.warning : Colors.danger,
                  }]} />
                </View>
                <Text style={[styles.batchPct, {
                  color: b.pct >= 75 ? Colors.primary : b.pct >= 50 ? Colors.warning : Colors.danger,
                }]}>{b.pct}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Needs attention */}
        <View style={[styles.card, { marginBottom: 100 }]}>
          <Text style={styles.cardTitle}>Needs Attention</Text>
          {needsAttention.length === 0 ? (
            <View style={styles.allGoodRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              <Text style={styles.allGoodText}>All students are on track!</Text>
            </View>
          ) : (
            needsAttention.map((a, i) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.alertRow, i < needsAttention.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
                onPress={() => router.push(`/student/${a.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.alertDot, {
                  backgroundColor: a.type === 'fee' ? Colors.danger : Colors.warning,
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertName}>{a.name}</Text>
                  <Text style={styles.alertMsg}>{a.msg}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  greetingBlock: { padding: 16, paddingBottom: 8 },
  greetingText: { fontSize: 22, fontWeight: '800', color: Colors.text },
  greetingSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  streakCard: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 16,
    backgroundColor: Colors.dark,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderWidth: 1, borderColor: Colors.darkBorder,
  },
  streakLeft: {},
  streakLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fireEmoji: { fontSize: 18 },
  streakLabel: { fontSize: 13, color: Colors.textSecondaryOnDark, fontWeight: '600' },
  streakDays: { fontSize: 32, fontWeight: '900', color: Colors.textOnDark, marginBottom: 2 },
  streakKeep: { fontSize: 13, color: Colors.textSecondaryOnDark },
  streakBall: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 6,
  },
  streakNum: { fontSize: 30, fontWeight: '900', color: 'white' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  card: {
    backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  noFeeData: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  noFeeText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  noFeeSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  feeLegend: { flex: 1, gap: 12 },
  feeLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeDot: { width: 10, height: 10, borderRadius: 5 },
  feeAmt: { fontSize: 15, fontWeight: '700' },
  feeLbl: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  collectedBanner: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  collectedAmt: { fontSize: 20, fontWeight: '800', color: Colors.text },
  collectedSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  trendText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  ctaCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: Colors.surface,
    borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  ctaTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  ctaSub: { fontSize: 12, color: Colors.textSecondary },
  ctaArrow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  todayBatchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  todayDot: { width: 8, height: 8, borderRadius: 4 },
  todayBatchName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  todayBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  todayBadgeText: { fontSize: 12, fontWeight: '700' },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  batchName: { fontSize: 13, fontWeight: '600', color: Colors.text, width: 90 },
  batchBarWrap: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  batchBarFill: { height: 8, borderRadius: 4 },
  batchPct: { fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  alertMsg: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  allGoodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  allGoodText: { fontSize: 14, color: Colors.textSecondary },
});
