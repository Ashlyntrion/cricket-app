import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Batch, Student } from '../types';

export interface Notif {
  id: string;
  type: 'absent' | 'fee';
  title: string;
  msg: string;
  time: string;
  route: string;
  phone?: string;
  amount?: number;
  daysUntilDue?: number;
}

interface DataContextType {
  batches: Batch[];
  batchLoading: boolean;
  addBatch: (b: Omit<Batch, 'id' | 'created_at'>) => Promise<{ data: Batch | null; error: any }>;
  refetchBatches: () => void;

  students: Student[];
  studentLoading: boolean;
  refetchStudents: () => void;
  addStudent: (s: Omit<Student, 'id' | 'created_at' | 'batch'>) => Promise<{ data: Student | null; error: any }>;
  updateStudent: (id: string, u: Partial<Student>) => Promise<any>;
  archiveStudent: (id: string) => Promise<any>;

  coachName: string;
  coachInitials: string;
  academyName: string;

  notifs: Notif[];
  reloadNotifs: () => void;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchLoading, setBatchLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentLoading, setStudentLoading] = useState(true);
  const [coachName, setCoachName] = useState('Coach');
  const [coachInitials, setCoachInitials] = useState('CO');
  const [academyName, setAcademyName] = useState('Cricket Academy');
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const fetchBatches = useCallback(async () => {
    setBatchLoading(true);
    const { data } = await supabase.from('batches').select('*').order('name');
    setBatches(data || []);
    setBatchLoading(false);
  }, []);

  const fetchStudents = useCallback(async () => {
    setStudentLoading(true);
    const { data } = await supabase
      .from('students')
      .select('*, batch:batches(*)')
      .eq('is_active', true)
      .order('name');
    setStudents(data || []);
    setStudentLoading(false);
  }, []);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const raw = user.user_metadata?.full_name || user.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Coach';
    const name = raw.replace(/\b\w/g, (c: string) => c.toUpperCase());
    const words = name.trim().split(/\s+/);
    setCoachName(name);
    setAcademyName(user.user_metadata?.academy_name || 'Cricket Academy');
    setCoachInitials(
      words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()
    );
  }, []);

  const reloadNotifs = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    const [studentsRes, plansRes, paidRes] = await Promise.all([
      supabase.from('students').select('id, name, phone').eq('is_active', true),
      supabase.from('fee_plans').select('student_id, due_day, amount'),
      supabase.from('fee_payments').select('student_id').eq('for_month', monthStr),
    ]);

    const allStudents = (studentsRes.data || []) as any[];
    const planMap = new Map((plansRes.data || []).map((p: any) => [p.student_id, p]));
    const paidIds = new Set((paidRes.data || []).map((p: any) => p.student_id));
    const now = new Date();

    // Overdue fee notifications
    const feeNotifs: Notif[] = allStudents
      .filter((s) => {
        if (paidIds.has(s.id)) return false;
        const plan = planMap.get(s.id);
        if (!plan) return false;
        return now > new Date(now.getFullYear(), now.getMonth(), plan.due_day);
      })
      .slice(0, 5)
      .map((s) => {
        const plan = planMap.get(s.id);
        const dueDate = new Date(now.getFullYear(), now.getMonth(), plan.due_day);
        const days = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
        return {
          id: s.id,
          type: 'fee' as const,
          title: s.name,
          msg: `Fee overdue by ${days} day${days !== 1 ? 's' : ''}`,
          time: `${days}d ago`,
          route: '/(tabs)/fees',
          phone: s.phone ?? undefined,
          amount: plan.amount,
        };
      });

    // Due-in-3-days notifications
    const dueSoonNotifs: Notif[] = allStudents
      .filter((s) => {
        if (paidIds.has(s.id)) return false;
        const plan = planMap.get(s.id);
        if (!plan || !plan.amount) return false;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), plan.due_day);
        const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        return diff >= 0 && diff <= 3;
      })
      .slice(0, 5)
      .map((s) => {
        const plan = planMap.get(s.id);
        const dueDate = new Date(now.getFullYear(), now.getMonth(), plan.due_day);
        const days = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        return {
          id: `due-soon-${s.id}`,
          type: 'fee' as const,
          title: s.name,
          msg: days === 0 ? 'Fee due today' : `Fee due in ${days} day${days !== 1 ? 's' : ''}`,
          time: days === 0 ? 'Today' : `${days}d`,
          route: '/(tabs)/fees',
          phone: s.phone ?? undefined,
          amount: plan.amount,
          daysUntilDue: days,
        };
      });

    // Step 1: get today's session IDs
    const { data: sessions } = await supabase.from('sessions').select('id').eq('date', today);
    let absentNotifs: Notif[] = [];
    if (sessions && sessions.length > 0) {
      const { data: absentRecs } = await supabase
        .from('attendance')
        .select('student_id, student:students(name)')
        .in('session_id', sessions.map((s: any) => s.id))
        .eq('status', 'absent')
        .limit(5);
      absentNotifs = (absentRecs || []).map((r: any) => ({
        id: r.student_id,
        type: 'absent' as const,
        title: r.student?.name ?? 'Student',
        msg: 'Absent today',
        time: 'Today',
        route: '/(tabs)/attendance',
      }));
    }
    setNotifs([...feeNotifs, ...dueSoonNotifs, ...absentNotifs]);
  }, []);

  useEffect(() => {
    // onAuthStateChange always fires INITIAL_SESSION on startup — use it as the
    // single source of truth so we never get stuck in a loading state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          fetchBatches();
          fetchStudents();
          loadProfile();
          reloadNotifs();
        } else if (event === 'INITIAL_SESSION') {
          // No session on initial load — stop spinners so app redirects to login
          setBatchLoading(false);
          setStudentLoading(false);
        }
      }
      if (event === 'USER_UPDATED') {
        loadProfile();
      }
      if (event === 'SIGNED_OUT') {
        setBatches([]);
        setStudents([]);
        setNotifs([]);
        setBatchLoading(false);
        setStudentLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const addBatch = useCallback(async (batch: Omit<Batch, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('batches').insert(batch).select().single();
    if (!error && data) setBatches((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { data, error };
  }, []);

  const addStudent = useCallback(async (student: Omit<Student, 'id' | 'created_at' | 'batch'>) => {
    const { data, error } = await supabase
      .from('students')
      .insert(student)
      .select('*, batch:batches(*)')
      .single();
    if (!error && data) setStudents((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { data, error };
  }, []);

  const updateStudent = useCallback(async (id: string, updates: Partial<Student>) => {
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select('*, batch:batches(*)')
      .single();
    if (!error && data) setStudents((prev) => prev.map((s) => (s.id === id ? data : s)));
    return { data, error };
  }, []);

  const archiveStudent = useCallback(async (id: string) => {
    const { error } = await supabase.from('students').update({ is_active: false }).eq('id', id);
    if (!error) setStudents((prev) => prev.filter((s) => s.id !== id));
    return { error };
  }, []);

  const value = useMemo(() => ({
    batches, batchLoading, addBatch, refetchBatches: fetchBatches,
    students, studentLoading, refetchStudents: fetchStudents, addStudent, updateStudent, archiveStudent,
    coachName, coachInitials, academyName,
    notifs, reloadNotifs,
  }), [batches, batchLoading, students, studentLoading, coachName, coachInitials, academyName, notifs]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
