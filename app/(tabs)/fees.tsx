import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FeeStatus } from '../../types';
import { AppHeader } from '../../components/AppHeader';
import { useFees } from '../../hooks/useFees';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';

type TabType = 'month' | 'collection' | 'overdue';

interface FeeRecord {
  id: string;
  name: string;
  phone: string;
  batch: string;
  amount: number;
  status: FeeStatus;
  daysOverdue?: number;
  daysUntilDue?: number;
  paidDate?: string;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

const monthStr = new Date().toISOString().slice(0, 7);

export default function FeesScreen() {
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('month');
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [reminderModal, setReminderModal] = useState(false);
  const [dueSoonFees, setDueSoonFees] = useState<FeeRecord[]>([]);
  const reminderShownRef = useRef(false);

  const { recordPayment } = useFees();
  const { coachName, academyName, students } = useData();

  const sendWhatsApp = (fee: FeeRecord & { phone?: string }) => {
    if (!fee.phone) {
      Alert.alert('No phone number', 'This student has no phone number saved.');
      return;
    }
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    let msg = '';
    if (fee.status === 'overdue') {
      msg = `Hi ${fee.name}, your cricket coaching fee of ₹${fee.amount.toLocaleString()} for ${month} is overdue by ${fee.daysOverdue} day${fee.daysOverdue !== 1 ? 's' : ''}. Please pay at the earliest. – ${coachName}, ${academyName}`;
    } else {
      msg = `Hi ${fee.name}, your cricket coaching fee of ₹${fee.amount.toLocaleString()} for ${month} is due soon. Please arrange the payment. – ${coachName}, ${academyName}`;
    }
    const phone = fee.phone.replace(/\D/g, '');
    const dialCode = phone.length === 10 ? `91${phone}` : phone;
    Linking.openURL(`https://wa.me/${dialCode}?text=${encodeURIComponent(msg)}`);
  };

  const loadFees = async () => {
    setDataLoading(true);
    const [studentsRes, plansRes, paymentsRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, name, phone, batch:batches(name)')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('fee_plans')
        .select('student_id, amount, due_day'),
      supabase
        .from('fee_payments')
        .select('student_id, amount, payment_date')
        .eq('for_month', monthStr),
    ]);

    const studentsList = (studentsRes.data || []) as any[];
    const plansList = (plansRes.data || []) as any[];
    const paymentsList = (paymentsRes.data || []) as any[];
    const planMap = new Map(plansList.map((p) => [p.student_id, p]));
    const paymentMap = new Map(paymentsList.map((p) => [p.student_id, p]));

    const today = new Date();
    const records: FeeRecord[] = studentsList.map((s) => {
      const plan = planMap.get(s.id) ?? null;
      const payment = paymentMap.get(s.id) ?? null;

      let status: FeeStatus = 'pending';
      let paidDate: string | undefined;
      let daysOverdue: number | undefined;
      let daysUntilDue: number | undefined;

      if (payment) {
        status = 'paid';
        paidDate = payment.payment_date
          ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          : 'This month';
      } else if (plan) {
        const dueDate = new Date(today.getFullYear(), today.getMonth(), plan.due_day);
        if (today > dueDate) {
          status = 'overdue';
          daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
        } else {
          status = 'pending';
          daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
        }
      }

      return {
        id: s.id,
        name: s.name,
        phone: s.phone ?? '',
        batch: s.batch?.name ?? '',
        amount: plan?.amount ?? 0,
        status,
        paidDate,
        daysOverdue,
        daysUntilDue,
      };
    });

    setFees(records);
    setDataLoading(false);

    // Auto-trigger WhatsApp reminders for students with fees due within 3 days
    if (!reminderShownRef.current) {
      const dueSoon = records.filter(
        (f) => f.status !== 'paid' && f.daysUntilDue !== undefined && f.daysUntilDue <= 3 && f.amount > 0 && f.phone
      );
      if (dueSoon.length > 0) {
        reminderShownRef.current = true;
        setDueSoonFees(dueSoon);
        setReminderModal(true);
      }
    }
  };

  useEffect(() => { loadFees(); }, [students.length]);

  const collected = fees.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
  const pending = fees.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
  const overdue = fees.filter((f) => f.status === 'overdue').reduce((s, f) => s + f.amount, 0);

  const displayed = activeTab === 'collection'
    ? fees.filter((f) => f.status === 'paid')
    : activeTab === 'overdue'
    ? fees.filter((f) => f.status === 'overdue')
    : fees;

  const doMarkPaid = async (fee: FeeRecord) => {
    const { error } = await recordPayment({
      student_id: fee.id,
      amount: fee.amount,
      payment_date: new Date().toISOString().slice(0, 10),
      for_month: monthStr,
    });
    if (error) {
      Alert.alert('Error', 'Could not record payment. Please try again.');
    } else {
      setFees((prev) =>
        prev.map((f) =>
          f.id === fee.id
            ? { ...f, status: 'paid', paidDate: 'Today', daysOverdue: undefined, daysUntilDue: undefined }
            : f
        )
      );
    }
  };

  const confirmPaid = (fee: FeeRecord) => {
    Alert.alert('Record Payment', `Mark ₹${fee.amount.toLocaleString()} from ${fee.name} as collected?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => doMarkPaid(fee) },
    ]);
  };

  const statusIcon = (f: FeeRecord) => {
    if (f.status === 'paid') return <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />;
    if (f.status === 'overdue') return <Ionicons name="close-circle" size={22} color={Colors.danger} />;
    return <Ionicons name="time" size={22} color={Colors.warning} />;
  };

  const statusSubtext = (f: FeeRecord) => {
    if (f.status === 'paid') return { text: `Paid ${f.paidDate ?? ''}`, color: Colors.primary };
    if (f.status === 'overdue') return { text: `Overdue by ${f.daysOverdue} day${f.daysOverdue !== 1 ? 's' : ''}`, color: Colors.danger };
    if (f.daysUntilDue === undefined) return { text: 'No fee plan set', color: Colors.textSecondary };
    return { text: `Due in ${f.daysUntilDue} day${f.daysUntilDue !== 1 ? 's' : ''}`, color: Colors.warning };
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Fees" />

      <View style={styles.tabs}>
        {([
          { key: 'month', label: 'This Month' },
          { key: 'collection', label: 'Collection' },
          { key: 'overdue', label: 'Overdue' },
        ] as { key: TabType; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statAmt, { color: Colors.primary }]}>₹{collected.toLocaleString()}</Text>
          <Text style={styles.statLbl}>Collected</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMid]}>
          <Text style={[styles.statAmt, { color: Colors.warning }]}>₹{pending.toLocaleString()}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statAmt, { color: Colors.danger }]}>₹{overdue.toLocaleString()}</Text>
          <Text style={styles.statLbl}>Overdue</Text>
        </View>
      </View>

      {dataLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {displayed.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {activeTab === 'overdue' ? 'No overdue fees!' : 'No records found'}
                </Text>
              </View>
            ) : (
              displayed.map((fee) => {
                const sub = statusSubtext(fee);
                return (
                  <View key={fee.id} style={styles.feeCard}>
                    <View style={styles.feeAvatar}>
                      <Text style={styles.feeInitials}>{getInitials(fee.name)}</Text>
                    </View>
                    <View style={styles.feeInfo}>
                      <Text style={styles.feeName}>{fee.name}</Text>
                      <Text style={styles.feeBatch}>{fee.batch}</Text>
                      <Text style={[styles.feeSubtext, { color: sub.color }]}>{sub.text}</Text>
                    </View>
                    <View style={styles.feeRight}>
                      <Text style={styles.feeAmt}>{fee.amount > 0 ? `₹${fee.amount.toLocaleString()}` : '—'}</Text>
                      {statusIcon(fee)}
                      {fee.status !== 'paid' && fee.amount > 0 && (
                        <View style={styles.feeActions}>
                          <TouchableOpacity style={styles.waBtn} onPress={() => sendWhatsApp(fee)}>
                            <Ionicons name="logo-whatsapp" size={14} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.payBtn} onPress={() => confirmPaid(fee)}>
                            <Text style={styles.payBtnText}>Pay</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={styles.fabRow}>
        <TouchableOpacity style={styles.fab} onPress={() => setPayModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.fabText}>Record Payment</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={payModalVisible} transparent animationType="slide" onRequestClose={() => setPayModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPayModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.modalSub}>Select a student to mark as paid</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {fees.filter((f) => f.status !== 'paid').map((fee) => (
                <TouchableOpacity
                  key={fee.id}
                  style={styles.modalRow}
                  onPress={() => { setPayModalVisible(false); confirmPaid(fee); }}
                >
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalInitials}>{getInitials(fee.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalName}>{fee.name}</Text>
                    <Text style={styles.modalBatch}>{fee.batch}</Text>
                  </View>
                  <Text style={[styles.modalAmt, { color: fee.status === 'overdue' ? Colors.danger : Colors.warning }]}>
                    ₹{fee.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
              {fees.filter((f) => f.status !== 'paid').length === 0 && (
                <Text style={styles.modalEmpty}>All payments are collected! 🎉</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Auto WhatsApp Reminder Modal — fires when fees due within 3 days */}
      <Modal visible={reminderModal} transparent animationType="slide" onRequestClose={() => setReminderModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReminderModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.reminderHeader}>
              <View style={styles.reminderIconWrap}>
                <Ionicons name="alarm" size={22} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Fee Reminders</Text>
                <Text style={styles.modalSub}>
                  {dueSoonFees.length} student{dueSoonFees.length > 1 ? 's have' : ' has'} fees due within 3 days
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReminderModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {dueSoonFees.map((fee, i) => (
                <View
                  key={fee.id}
                  style={[styles.reminderRow, i < dueSoonFees.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
                >
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalInitials}>{getInitials(fee.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalName}>{fee.name}</Text>
                    <Text style={[styles.modalBatch, { color: Colors.warning }]}>
                      Due in {fee.daysUntilDue} day{fee.daysUntilDue !== 1 ? 's' : ''} · ₹{fee.amount.toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reminderWaBtn}
                    onPress={() => sendWhatsApp(fee)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="white" />
                    <Text style={styles.reminderWaBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 8 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  statsRow: { flexDirection: 'row', padding: 14, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statCardMid: { borderTopWidth: 3, borderTopColor: Colors.warning },
  statAmt: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  statLbl: { fontSize: 11, color: Colors.textSecondary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 14, gap: 10 },
  feeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  feeAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  feeInitials: { fontSize: 15, fontWeight: '700', color: Colors.text },
  feeInfo: { flex: 1 },
  feeName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  feeBatch: { fontSize: 12, color: Colors.textSecondary, marginBottom: 3 },
  feeSubtext: { fontSize: 12, fontWeight: '600' },
  feeRight: { alignItems: 'flex-end', gap: 5 },
  feeAmt: { fontSize: 15, fontWeight: '800', color: Colors.text },
  feeActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waBtn: {
    backgroundColor: '#25D366', borderRadius: 6,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  payBtn: { backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  payBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  fabRow: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, paddingBottom: 12 },
  fab: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fabText: { color: 'white', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '75%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  modalInitials: { fontSize: 13, fontWeight: '700', color: Colors.text },
  modalName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  modalBatch: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  modalAmt: { fontSize: 15, fontWeight: '800' },
  modalEmpty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24, fontSize: 14 },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  reminderIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  reminderWaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  reminderWaBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
});
