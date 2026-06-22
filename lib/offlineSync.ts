import { supabase } from './supabase';
import { getQueue, removeFromQueue } from './offlineStore';

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const syncedIds: string[] = [];

  for (const action of queue) {
    if (action.type !== 'mark_attendance') continue;

    try {
      const { batch_id, date, records } = action.payload;

      // Find or create the session
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('batch_id', batch_id)
        .eq('date', date)
        .single();

      let sessionId: string;
      if (existing) {
        sessionId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('sessions')
          .insert({ batch_id, date })
          .select('id')
          .single();
        if (createErr || !created) throw createErr ?? new Error('session create failed');
        sessionId = created.id;
      }

      // Upsert all attendance records for this session
      const { error: upsertErr } = await supabase.from('attendance').upsert(
        records.map((r) => ({ session_id: sessionId, student_id: r.student_id, status: r.status })),
        { onConflict: 'session_id,student_id' }
      );
      if (upsertErr) throw upsertErr;

      syncedIds.push(action.id);
      synced++;
    } catch {
      failed++;
    }
  }

  if (syncedIds.length > 0) await removeFromQueue(syncedIds);
  return { synced, failed };
}
