import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';
import { DayPicker, formatTrainingDays } from '../components/DayPicker';

export default function SettingsScreen() {
  const [coachName, setCoachName] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [batchDays, setBatchDays] = useState<Record<string, string[]>>({});
  const [savingBatch, setSavingBatch] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const { batches, refetchBatches, userRole, coaches, refetchCoaches } = useData();

  useEffect(() => {
    const map: Record<string, string[]> = {};
    batches.forEach((b) => { map[b.id] = b.training_days || []; });
    setBatchDays(map);
  }, [batches.length]);

  const saveBatchDays = async (batchId: string) => {
    setSavingBatch(batchId);
    await supabase.from('batches').update({ training_days: batchDays[batchId] || [] }).eq('id', batchId);
    setSavingBatch(null);
    refetchBatches();
    Alert.alert('Saved', 'Training schedule updated.');
  };

  const handleInviteCoach = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    const { error } = await supabase.functions.invoke('invite-coach', {
      body: { email: inviteEmail.trim().toLowerCase(), full_name: inviteName.trim() },
    });
    setInviting(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not send invite. Make sure the Edge Function is deployed.');
      return;
    }
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    refetchCoaches();
    Alert.alert('Invite Sent!', `${inviteName} will receive an email to set up their account.`);
  };

  const handleRemoveCoach = (coachId: string, name: string) => {
    Alert.alert('Remove Coach', `Remove ${name} from the academy?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('profiles').delete().eq('id', coachId);
          refetchCoaches();
        },
      },
    ]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? '');
      setCoachName(user.user_metadata?.full_name ?? '');
      setAcademyName(user.user_metadata?.academy_name ?? '');
    });
  }, []);

  const handleSaveProfile = async () => {
    if (!coachName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: coachName.trim(),
        academy_name: academyName.trim(),
      },
    });
    setSavingProfile(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved', 'Profile updated successfully.');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Weak password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Done', 'Password changed successfully.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
          setSigningOut(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Profile</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Coach Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textLight}
                value={coachName}
                onChangeText={setCoachName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Academy Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your academy name"
                placeholderTextColor={Colors.textLight}
                value={academyName}
                onChangeText={setAcademyName}
              />
            </View>

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.input, styles.inputReadonly]}>
                <Text style={styles.readonlyText}>{email}</Text>
              </View>
              <Text style={styles.hint}>Email cannot be changed here.</Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, savingProfile && styles.btnDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.btnText}>Save Profile</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Change Password */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Change Password</Text>

            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.pwRow}>
                <TextInput
                  style={[styles.input, styles.pwInput]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.textLight}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPw(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showNewPw ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.pwRow}>
                <TextInput
                  style={[styles.input, styles.pwInput]}
                  placeholder="Repeat new password"
                  placeholderTextColor={Colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirmPw ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, (!newPassword || !confirmPassword || savingPassword) && styles.btnDisabled]}
              onPress={handleChangePassword}
              disabled={!newPassword || !confirmPassword || savingPassword}
            >
              {savingPassword
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.btnText}>Update Password</Text>
              }
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>App</Text>
              <Text style={styles.infoVal}>Cricket Academy Manager</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Version</Text>
              <Text style={styles.infoVal}>1.0.0</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoKey}>Platform</Text>
              <Text style={styles.infoVal}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
            </View>
          </View>

          {/* Coaches — admin only */}
          {userRole === 'admin' && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={styles.sectionLabel}>Coaches</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primarySurface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '700' }}>Invite Coach</Text>
                </TouchableOpacity>
              </View>
              {coaches.length === 0 ? (
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>No coaches yet. Invite one above.</Text>
              ) : (
                coaches.map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.role === 'admin' ? Colors.primarySurface : Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: Colors.border }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                        {c.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text }}>{c.full_name}</Text>
                      {c.email && <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{c.email}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: c.role === 'admin' ? Colors.primarySurface : Colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.role === 'admin' ? Colors.primary : Colors.border }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: c.role === 'admin' ? Colors.primary : Colors.textSecondary }}>
                          {c.role === 'admin' ? 'Admin' : 'Coach'}
                        </Text>
                      </View>
                      {c.role !== 'admin' && (
                        <TouchableOpacity onPress={() => handleRemoveCoach(c.id, c.full_name)}>
                          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Manage Batches */}
          {batches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Batch Schedules</Text>
              {batches.map((b, i) => (
                <View key={b.id} style={[{ marginBottom: 18 }, i === batches.length - 1 && { marginBottom: 0 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>{b.name}</Text>
                    {batchDays[b.id]?.length > 0 && (
                      <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>
                        {formatTrainingDays(batchDays[b.id])}
                      </Text>
                    )}
                  </View>
                  <DayPicker
                    selected={batchDays[b.id] || []}
                    onChange={(days) => setBatchDays((prev) => ({ ...prev, [b.id]: days }))}
                  />
                  <TouchableOpacity
                    style={[styles.btn, { marginTop: 10, backgroundColor: Colors.primary }]}
                    onPress={() => saveBatchDays(b.id)}
                    disabled={savingBatch === b.id}
                  >
                    {savingBatch === b.id
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={[styles.btnText, { color: 'white' }]}>Save Schedule</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Sign Out */}
          <View style={[styles.section, { marginBottom: 40 }]}>
            <TouchableOpacity
              style={[styles.btn, styles.signOutBtn, signingOut && styles.btnDisabled]}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut
                ? <ActivityIndicator size="small" color={Colors.danger} />
                : (
                  <>
                    <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
                    <Text style={[styles.btnText, { color: Colors.danger }]}>Sign Out</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Invite Coach Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInviteModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Invite a Coach</Text>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 16 }}>
                They'll receive an email to set up their account and can log in to see all students, batches, and attendance.
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ravi Sharma"
                  placeholderTextColor={Colors.textLight}
                  value={inviteName}
                  onChangeText={setInviteName}
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="coach@gmail.com"
                  placeholderTextColor={Colors.textLight}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: Colors.primary, marginTop: 8 }, (!inviteName.trim() || !inviteEmail.trim()) && { backgroundColor: Colors.border }]}
                onPress={handleInviteCoach}
                disabled={!inviteName.trim() || !inviteEmail.trim() || inviting}
              >
                {inviting
                  ? <ActivityIndicator size="small" color="white" />
                  : (
                    <>
                      <Ionicons name="paper-plane-outline" size={16} color="white" />
                      <Text style={[styles.btnText, { color: 'white' }]}>Send Invite</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeBtn: { padding: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputReadonly: { justifyContent: 'center' },
  readonlyText: { fontSize: 15, color: Colors.textSecondary },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  pwInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
  eyeBtn: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: 16, flexDirection: 'row', gap: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  signOutBtn: { backgroundColor: Colors.primarySurface, borderWidth: 1.5, borderColor: Colors.danger },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoKey: { fontSize: 14, color: Colors.textSecondary },
  infoVal: { fontSize: 14, fontWeight: '600', color: Colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
});
