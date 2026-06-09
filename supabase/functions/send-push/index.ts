import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  webpush.setVapidDetails('mailto:coach@cricketapp.com', vapidPublic, vapidPrivate);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const monthStr = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Load fee data
  const [studentsRes, plansRes, paidRes] = await Promise.all([
    supabase.from('students').select('id, name').eq('is_active', true),
    supabase.from('fee_plans').select('student_id, due_day, amount'),
    supabase.from('fee_payments').select('student_id').eq('for_month', monthStr),
  ]);

  const students = (studentsRes.data || []) as any[];
  const planMap = new Map((plansRes.data || []).map((p: any) => [p.student_id, p]));
  const paidIds = new Set((paidRes.data || []).map((p: any) => p.student_id));

  // Overdue fees
  const overdueStudents = students.filter((s) => {
    if (paidIds.has(s.id)) return false;
    const plan = planMap.get(s.id);
    if (!plan) return false;
    return now > new Date(now.getFullYear(), now.getMonth(), plan.due_day);
  });

  // Due in 3 days
  const dueSoonStudents = students.filter((s) => {
    if (paidIds.has(s.id)) return false;
    const plan = planMap.get(s.id);
    if (!plan) return false;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), plan.due_day);
    const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    return diff >= 0 && diff <= 3;
  });

  // Today's absences
  const { data: sessions } = await supabase.from('sessions').select('id').eq('date', today);
  let absentCount = 0;
  if (sessions && sessions.length > 0) {
    const { data: absences } = await supabase
      .from('attendance')
      .select('id')
      .in('session_id', sessions.map((s: any) => s.id))
      .eq('status', 'absent');
    absentCount = absences?.length ?? 0;
  }

  // Build notification messages
  const notifications: { title: string; body: string; url: string }[] = [];

  if (overdueStudents.length > 0) {
    notifications.push({
      title: '⚠️ Overdue Fees',
      body: `${overdueStudents.length} student${overdueStudents.length > 1 ? 's have' : ' has'} unpaid fees this month`,
      url: '/fees',
    });
  }

  if (dueSoonStudents.length > 0) {
    notifications.push({
      title: '⏰ Fees Due Soon',
      body: `${dueSoonStudents.length} student${dueSoonStudents.length > 1 ? 's have' : ' has'} fees due within 3 days`,
      url: '/fees',
    });
  }

  if (absentCount > 0) {
    notifications.push({
      title: '📋 Absences Today',
      body: `${absentCount} student${absentCount > 1 ? 's were' : ' was'} absent in today's session`,
      url: '/attendance',
    });
  }

  if (notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'Nothing to notify' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get all push subscriptions
  const { data: subs } = await supabase.from('push_subscriptions').select('subscription');
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  for (const row of subs) {
    for (const notif of notifications) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(notif));
        sent++;
      } catch (err: any) {
        // Remove stale subscriptions (410 Gone)
        if (err.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription', row.subscription);
        }
        console.error('Push send failed:', err.message);
      }
    }
  }

  return new Response(JSON.stringify({ sent, message: `Sent ${sent} push notifications` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
