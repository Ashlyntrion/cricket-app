import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  Modal, ActivityIndicator, Linking,
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
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [reminderModal, setReminderModal] = useState(false);
  const [dueSoonFees, setDueSoonFees] = useState<FeeRecord[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmFee, setConfirmFee] = useState<FeeRecord | null>(null);
  const reminderShownRef = useRef(false);

  const { recordPayment } = useFees();
  const { coachName, academyName, students } = useData();

  const sendWhatsApp = (fee: FeeRecord) => {
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    let msg = '';
    if (fee.status === 'overdue') {
      msg = `Hi ${fee.name}, your cricket coaching fee of ₹${fee.amount.toLocaleString()} for ${month} is overdue by ${fee.daysOverdue} day${fee.daysOverdue !== 1 ? 's' : ''}. Please pay at the earliest. – ${coachName}, ${academyName}`;
    } else {
      msg = `Hi ${fee.name}, your cricket coaching fee of ₹${fee.amount.toLocaleString()} for ${month} is due soon. Please arrange the payment. – ${coachName}, ${academyName}`;
    }
    const phone = (fee.phone || '').replace(/\D/g, '');
    const dialCode = phone.length === 10 ? `91${phone}` : phone;
    if (!dialCode) return;
    Linking.openURL(`https://wa.me/${dialCode}?text=${encodeURIComponent(msg)}`);
  };

  const loadFees = async () => {
    setDataLoading(true);
    const [studentsRes, plansRes, paymentsRes] = await Promise.all([
      supabase.from('students').select('id, name, phone, batch:batches(name)').eq('is_active', true).order('name'),
      supabase.from('fee_plans').select('student_id, amount, due_day'),
      supabase.from('fee_payments').select('student_id, amount, payment_date').eq('for_month', monthStr),
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

      return { id: s.id, name: s.name, phone: s.phone ?? '', batch: s.batch?.name ?? '', amount: plan?.amount ?? 0, status, paidDate, daysOverdue, daysUntilDue };
    });

    setFees(records);
    setDataLoading(false);

    if (!reminderShownRef.current) {
      const dueSoon = records.filter((f) => f.status !== 'paid' && f.daysUntilDue !== undefined && f.daysUntilDue <= 3 && f.amount > 0 && f.phone);
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
    setSaveError(null);
    setSavingId(fee.id);
    const { error } = await recordPayment({
      student_id: fee.id,
      amount: fee.amount,
      payment_date: new Date().toISOString().slice(0, 10),
      for_month: monthStr,
    });
    setSavingId(null);
    if (error) {
      setSaveError('Could not record payment. Please try again.');
    } else {
      setFees((prev) =>
        prev.map((f) => f.id === fee.id ? { ...f, status: 'paid', paidDate: 'Today', daysOverdue: undefined, daysUntilDue: undefined } : f)
      );
      setSelectedFee(null);
    }
  };

  const openConfirm = (fee: FeeRecord) => {
    setSelectedFee(null);
    setConfirmFee(fee);
  };

  const handlePayFromModal = (fee: FeeRecord) => {
    setPayModalVisible(false);
    setTimeout(() => setConfirmFee(fee), 300);
  };

  const handleConfirmPay = () => {
    if (!confirmFee) return;
    const fee = confirmFee;
    setConfirmFee(null);
    setTimeout(() => doMarkPaid(fee), 200);
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

      <View style={styles.tabRow}>
        {([
          { key: 'month', label: 'This Month' },
          { key: 'collection', label: 'Collection' },
          { key: 'overdue', label: 'Overdue' },
        ] as { key: TabType; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => { setActiveTab(t.key); setSelectedFee(null); }}
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

      {saveError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="white" />
          <Text style={styles.errorBannerText}>{saveError}</Text>
          <TouchableOpacity onPress={() => setSaveError(null)}>
            <Ionicons name="close" size={16} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Fee list — cards are selectable rows only, NO buttons inside the ScrollView */}
      {dataLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                const unpaid = fee.status !== 'paid' && fee.amount > 0;
                const isSelected = selectedFee?.id === fee.id;
                return (
                  <Pressable
                    key={fee.id}
                    style={[styles.feeCard, isSelected && styles.feeCardSelected]}
                    onPress={() => unpaid ? setSelectedFee(isSelected ? null : fee) : undefined}
                  >
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
                      {unpaid && (
                        <Ionicons
                          name={isSelected ? 'chevron-down' : 'chevron-forward'}
                          size={14}
                          color={isSelected ? Colors.primary : Colors.textMuted}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/*
        ACTION BAR — lives OUTSIDE the ScrollView so iOS Safari touch events
        always reach it. Appears when an unpaid fee card is selected.
      */}
      {selectedFee && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBarName}>{selectedFee.name}</Text>
              <Text style={styles.actionBarSub}>
                ₹{selectedFee.amount.toLocaleString()} · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity style={styles.actionDismiss} onPress={() => setSelectedFee(null)}>
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.actionWaBtn}
              onPress={() => { sendWhatsApp(selectedFee); setSelectedFee(null); }}
            >
              <Ionicons name="logo-whatsapp" size={18} color="white" />
              <Text style={styles.actionBtnText}>Remind</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionPayBtn}
              onPress={() => openConfirm(selectedFee)}
              disabled={savingId === selectedFee.id}
            >
              {savingId === selectedFee.id
                ? <ActivityIndicator size="small" color="white" />
                : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                    <Text style={styles.actionBtnText}>Mark as Paid</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.fabRow}>
        <TouchableOpacity style={styles.fab} onPress={() => setPayModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.fabText}>Record Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Record Payment modal */}
      <Modal visible={payModalVisible} transparent animationType="slide" onRequestClose={() => setPayModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPayModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.modalSub}>Select a student to mark as paid</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {fees.filter((f) => f.status !== 'paid').map((fee) => (
                <TouchableOpacity key={fee.id} style={styles.modalRow} onPress={() => handlePayFromModal(fee)}>
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Payment confirmation dialog */}
      <Modal visible={!!confirmFee} transparent animationType="fade" onRequestClose={() => setConfirmFee(null)}>
        <View style={styles.confirmOverlay}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>Confirm Payment?</Text>
            {confirmFee && (
              <>
                <Text style={styles.confirmName}>{confirmFee.name}</Text>
                <Text style={styles.confirmAmt}>₹{confirmFee.amount.toLocaleString()}</Text>
                <Text style={styles.confirmMonth}>
                  {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
              </>
            )}
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmFee(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOk} onPress={handleConfirmPay}>
                <Text style={styles.confirmOkText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* WhatsApp reminder modal — auto-shown when fees due within 3 days */}
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  <TouchableOpacity style={styles.reminderWaBtn} onPress={() => sendWhatsApp(fee)}>
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

  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  statsRow: { flexDirection: 'row', padding: 14, gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statCardMid: { borderTopWidth: 3, borderTopColor: Colors.warning },
  statAmt: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  statLbl: { fontSize: 11, color: Colors.textSecondary },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger, marginHorizontal: 14, marginBottom: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  errorBannerText: { flex: 1, color: 'white', fontSize: 13, fontWeight: '600' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 14, gap: 10, paddingTop: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },

  feeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  feeCardSelected: { borderColor: Colors.primary, borderWidth: 2 },
  feeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  feeInitials: { fontSize: 15, fontWeight: '700', color: Colors.text },
  feeInfo: { flex: 1 },
  feeName: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  feeBatch: { fontSize: 12, color: Colors.textSecondary, marginBottom: 3 },
  feeSubtext: { fontSize: 12, fontWeight: '600' },
  feeRight: { alignItems: 'flex-end', gap: 4 },
  feeAmt: { fontSize: 15, fontWeight: '800', color: Colors.text },

  // Action bar — rendered outside ScrollView for reliable iOS touch handling
  actionBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
  },
  actionBarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  actionBarName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  actionBarSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  actionDismiss: { padding: 4 },
  actionBtns: { flexDirection: 'row', gap: 10 },
  actionWaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#25D366', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  actionPayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
  },
  actionBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },

  fabRow: { padding: 14, paddingBottom: 12 },
  fab: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fabText: { color: 'white', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '75%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  modalInitials: { fontSize: 13, fontWeight: '700', color: Colors.text },
  modalName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  modalBatch: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  modalAmt: { fontSize: 15, fontWeight: '800' },
  modalEmpty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24, fontSize: 14 },

  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  reminderIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  reminderWaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  reminderWaBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  confirmCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  confirmIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmTitle: { fontSize: 19, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  confirmName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  confirmAmt: { fontSize: 26, fontWeight: '900', color: Colors.primary, marginBottom: 4 },
  confirmMonth: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: { flex: 1, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  confirmOk: { flex: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmOkText: { fontSize: 15, fontWeight: '700', color: 'white' },
});
