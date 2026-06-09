import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

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
});
