import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Attendance, AttendanceStatus } from '../types';

export function useAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getOrCreateSession = async (batchId: string, date: string) => {
    const { data: existing } = await supabase
      .from('sessions')
      .select('*')
      .eq('batch_id', batchId)
      .eq('date', date)
      .single();

    if (existing) return existing;

    const { data, error: err } = await supabase
      .from('sessions')
      .insert({ batch_id: batchId, date })
      .select()
      .single();

    if (err) throw new Error(err.message);
    return data;
  };

  const getAttendanceForSession = useCallback(async (batchId: string, date: string): Promise<Attendance[]> => {
    setLoading(true);
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('batch_id', batchId)
      .eq('date', date)
      .single();

    if (!session) { setLoading(false); return []; }

    const { data, error: err } = await supabase
      .from('attendance')
      .select('*, student:students(*)')
      .eq('session_id', session.id);

    setLoading(false);
    if (err) { setError(err.message); return []; }
    return data || [];
  }, []);

  const markAttendance = async (
    batchId: string,
    date: string,
    records: { student_id: string; status: AttendanceStatus }[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const session = await getOrCreateSession(batchId, date);

      const upsertData = records.map((r) => ({
        session_id: session.id,
        student_id: r.student_id,
        status: r.status,
      }));

      const { error: err } = await supabase
        .from('attendance')
        .upsert(upsertData, { onConflict: 'session_id,student_id' });

      if (err) throw new Error(err.message);
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const getStudentAttendanceStats = useCallback(async (studentId: string, monthStr: string) => {
    const startDate = `${monthStr}-01`;
    const [year, month] = monthStr.split('-').map(Number);
    const endDate = `${monthStr}-${new Date(year, month, 0).getDate()}`;

    // Step 1: get all session IDs in this date range
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .gte('date', startDate)
      .lte('date', endDate);

    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length === 0) return { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

    // Step 2: get this student's attendance for those sessions
    const { data, error: err } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .in('session_id', sessionIds);

    if (err || !data) return { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

    const present = data.filter((r: any) => r.status === 'present').length;
    const late = data.filter((r: any) => r.status === 'late').length;
    const absent = data.filter((r: any) => r.status === 'absent').length;
    const total = data.length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { present, absent, late, total, percentage };
  }, []);

  const getRecentAttendance = useCallback(async (batchId: string, limit = 7) => {
    const { data, error: err } = await supabase
      .from('sessions')
      .select('*, attendance(count)')
      .eq('batch_id', batchId)
      .order('date', { ascending: false })
      .limit(limit);

    if (err) return [];
    return data || [];
  }, []);

  return { loading, error, markAttendance, getAttendanceForSession, getStudentAttendanceStats, getRecentAttendance };
}
