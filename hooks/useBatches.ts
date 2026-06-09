import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Batch } from '../types';

export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('batches').select('*').order('name');
    if (err) setError(err.message);
    else setBatches(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const addBatch = async (batch: Omit<Batch, 'id' | 'created_at'>) => {
    const { data, error: err } = await supabase.from('batches').insert(batch).select().single();
    if (!err && data) setBatches((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { data, error: err };
  };

  return { batches, loading, error, refetch: fetchBatches, addBatch };
}
