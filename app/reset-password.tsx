import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { CricketShield } from '../components/CricketShield';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError('');
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace('/(tabs)'), 2000);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
          <View style={styles.logoWrap}>
            <CricketShield size={100} />
          </View>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>Enter a new password for your account</Text>

          {done ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              <Text style={styles.successText}>Password updated! Redirecting…</Text>
            </View>
          ) : (
            <View style={styles.form}>
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, !!error && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={[styles.input, !!error && styles.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={confirm}
                  onChangeText={(t) => { setConfirm(t); setError(''); }}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.btnText}>Update Password</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textOnDark, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondaryOnDark, marginBottom: 36, textAlign: 'center' },
  form: { width: '100%', gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondaryOnDark },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.textOnDark,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    width: '100%',
  },
  inputError: { borderColor: Colors.danger },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger, fontWeight: '500' },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 10,
    padding: 16, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  successText: { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
