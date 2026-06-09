import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Student } from '../types';

export function useStudents(batchId?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('students')
      .select('*, batch:batches(*)')
      .eq('is_active', true)
      .order('name');

    if (batchId) query = query.eq('batch_id', batchId);

    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setStudents(data || []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const addStudent = async (student: Omit<Student, 'id' | 'created_at' | 'batch'>) => {
    const { data, error: err } = await supabase
      .from('students')
      .insert(student)
      .select('*, batch:batches(*)')
      .single();
    if (!err && data) setStudents((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { data, error: err };
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const { data, error: err } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select('*, batch:batches(*)')
      .single();
    if (!err && data) setStudents((prev) => prev.map((s) => (s.id === id ? data : s)));
    return { data, error: err };
  };

  const archiveStudent = async (id: string) => {
    const { error: err } = await supabase.from('students').update({ is_active: false }).eq('id', id);
    if (!err) setStudents((prev) => prev.filter((s) => s.id !== id));
    return { error: err };
  };

  return { students, loading, error, refetch: fetchStudents, addStudent, updateStudent, archiveStudent };
}
