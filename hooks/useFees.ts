import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { FeePlan, FeePayment, FeeStatus } from '../types';

export function useFees() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFeePlan = useCallback(async (studentId: string): Promise<FeePlan | null> => {
    const { data } = await supabase
      .from('fee_plans')
      .select('*')
      .eq('student_id', studentId)
      .single();
    return data || null;
  }, []);

  const upsertFeePlan = async (plan: Omit<FeePlan, 'id' | 'created_at'>) => {
    const { data, error: err } = await supabase
      .from('fee_plans')
      .upsert(plan, { onConflict: 'student_id' })
      .select()
      .single();
    return { data, error: err };
  };

  const getPaymentsForMonth = useCallback(async (monthStr: string): Promise<FeePayment[]> => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('fee_payments')
      .select('*, student:students(*)')
      .eq('for_month', monthStr);
    setLoading(false);
    if (err) { setError(err.message); return []; }
    return data || [];
  }, []);

  const recordPayment = async (payment: Omit<FeePayment, 'id' | 'created_at' | 'student'>) => {
    setLoading(true);
    // Check for existing payment first — avoids depending on a DB unique constraint
    const { data: existing } = await supabase
      .from('fee_payments')
      .select('id')
      .eq('student_id', payment.student_id)
      .eq('for_month', payment.for_month)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('fee_payments')
        .update({ amount: payment.amount, payment_date: payment.payment_date })
        .eq('id', existing.id)
        .select('*, student:students(*)')
        .single();
    } else {
      result = await supabase
        .from('fee_payments')
        .insert(payment)
        .select('*, student:students(*)')
        .single();
    }
    setLoading(false);
    if (result.error) setError(result.error.message);
    return { data: result.data, error: result.error };
  };

  const deletePayment = async (id: string) => {
    const { error: err } = await supabase.from('fee_payments').delete().eq('id', id);
    return { error: err };
  };

  const computeFeeStatus = (plan: FeePlan | null, payment: FeePayment | null): FeeStatus => {
    if (!plan) return 'pending';
    if (payment) return 'paid';
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), plan.due_day);
    return today > dueDate ? 'overdue' : 'pending';
  };

  const getMonthlyStats = useCallback(async (monthStr: string) => {
    const { data: payments } = await supabase
      .from('fee_payments')
      .select('amount')
      .eq('for_month', monthStr);

    const { data: plans } = await supabase.from('fee_plans').select('amount, student_id');

    const collected = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidIds = new Set((payments || []).map((p: any) => p.student_id));
    const outstanding = (plans || [])
      .filter((p) => !paidIds.has(p.student_id))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return { collected, outstanding, count: (payments || []).length };
  }, []);

  return { loading, error, getFeePlan, upsertFeePlan, getPaymentsForMonth, recordPayment, deletePayment, computeFeeStatus, getMonthlyStats };
}
