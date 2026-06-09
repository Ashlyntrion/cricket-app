import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

type State = { session: boolean; onboarded: boolean } | null;

export default function Index() {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem('hasSeenOnboarding'),
    ]).then(([{ data: { session } }, onboarded]) => {
      setState({ session: !!session, onboarded: !!onboarded });
    });
  }, []);

  if (state === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!state.onboarded) return <Redirect href="/onboarding" />;
  if (state.session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1923', alignItems: 'center', justifyContent: 'center' },
});
