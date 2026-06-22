import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const POLL_INTERVAL_MS = 10_000;

async function checkConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const prevOnline = useRef(true);
  const onReconnectRef = useRef<(() => void) | null>(null);

  const update = useCallback((online: boolean) => {
    setIsOnline(online);
    if (online && !prevOnline.current) {
      onReconnectRef.current?.();
    }
    prevOnline.current = online;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      update(navigator.onLine);
      const onOnline = () => update(true);
      const onOffline = () => update(false);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    // Native: poll periodically
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      const ok = await checkConnectivity();
      if (alive) update(ok);
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [update]);

  const setOnReconnect = useCallback((fn: () => void) => {
    onReconnectRef.current = fn;
  }, []);

  return { isOnline, setOnReconnect };
}
