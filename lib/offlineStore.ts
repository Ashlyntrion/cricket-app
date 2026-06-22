import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface QueuedAction {
  id: string;
  type: 'mark_attendance';
  payload: {
    batch_id: string;
    date: string;
    records: { student_id: string; status: string }[];
  };
  timestamp: number;
}

const KEYS = {
  batches: 'offline:cache:batches',
  students: 'offline:cache:students',
  queue: 'offline:sync:queue',
} as const;

type CacheKey = keyof typeof KEYS;

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function cacheSet(key: CacheKey, data: unknown) {
  await writeJSON(KEYS[key], { data, ts: Date.now() });
}

export async function cacheGet<T>(key: CacheKey): Promise<T | null> {
  const entry = await readJSON<{ data: T; ts: number }>(KEYS[key]);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'timestamp'>): Promise<QueuedAction> {
  const queue = await getQueue();
  const full: QueuedAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  // Replace any existing queued action for the same batch+date so we don't double-save
  const idx = queue.findIndex(
    (a) =>
      a.type === 'mark_attendance' &&
      a.payload.batch_id === action.payload.batch_id &&
      a.payload.date === action.payload.date
  );
  if (idx >= 0) {
    queue[idx] = full;
  } else {
    queue.push(full);
  }
  await writeJSON(KEYS.queue, queue);
  return full;
}

export async function getQueue(): Promise<QueuedAction[]> {
  return (await readJSON<QueuedAction[]>(KEYS.queue)) || [];
}

export async function removeFromQueue(ids: string[]) {
  const queue = await getQueue();
  await writeJSON(KEYS.queue, queue.filter((a) => !ids.includes(a.id)));
}

export async function clearQueue() {
  await AsyncStorage.removeItem(KEYS.queue);
}
