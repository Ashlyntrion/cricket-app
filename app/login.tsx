import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password mode
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      if (authError.message.toLowerCase().includes('invalid') || authError.message.toLowerCase().includes('wrong') || authError.message.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(authError.message);
      }
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim(),
      { redirectTo: 'https://cricket-app-iota-seven.vercel.app/reset-password' }
    );
    setResetLoading(false);
    if (resetError) {
      const msg = resetError.message.toLowerCase();
      if (msg.includes('load failed') || msg.includes('network') || msg.includes('fetch')) {
        setError('Network error. Check your internet connection and try again.');
      } else if (msg.includes('redirect')) {
        setError('Configuration error. Please contact support.');
      } else {
        setError(resetError.message);
      }
    } else {
      setResetSent(true);
    }
  };

  if (forgotMode) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
            <View style={styles.logoWrap}>
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {resetSent ? "Check your email for the reset link." : "Enter your email and we'll send a reset link."}
            </Text>

            {!resetSent ? (
              <View style={styles.form}>
                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, !!error && styles.inputError]}
                    placeholder="coach@example.com"
                    placeholderTextColor={Colors.textMuted}
                    value={resetEmail}
                    onChangeText={(t) => { setResetEmail(t); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.btn, resetLoading && styles.btnDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  {resetLoading
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.btnText}>Send Reset Link</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  <Text style={styles.successText}>Reset link sent to {resetEmail}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.backLink} onPress={() => { setForgotMode(false); setResetSent(false); setError(''); }}>
              <Ionicons name="arrow-back" size={16} color={Colors.textSecondaryOnDark} />
              <Text style={styles.backLinkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

          <View style={styles.logoWrap}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Cricket Academy</Text>
          <Text style={styles.subtitle}>Coach sign in</Text>

          <View style={styles.form}>
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, !!error && styles.inputError]}
                placeholder="coach@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, !!error && styles.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => { setForgotMode(true); setResetEmail(email); setError(''); }}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { marginBottom: 16 },
  logo: { width: 130, height: 130 },
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  successText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '500' },
  forgotLink: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: 13, color: Colors.textSecondaryOnDark, fontWeight: '600' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24 },
  backLinkText: { fontSize: 13, color: Colors.textSecondaryOnDark, fontWeight: '600' },
});
