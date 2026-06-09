import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { DataProvider } from '../contexts/DataContext';

export default function RootLayout() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (session) {
        router.replace('/(tabs)');
        // Register web push after sign-in (web only)
        if (Platform.OS === 'web') {
          const { registerPush } = await import('../lib/webPush');
          registerPush();
        }
      } else {
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <DataProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-student" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="student/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack>
      </DataProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1923' },
});
