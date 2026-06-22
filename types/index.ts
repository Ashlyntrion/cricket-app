export type AttendanceStatus = 'present' | 'absent' | 'late';
export type FeeStatus = 'paid' | 'pending' | 'overdue';
export type FeeFrequency = 'monthly' | 'quarterly';

export interface Batch {
  id: string;
  name: string;
  schedule: string;
  time: string;
  training_days: string[];
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  email?: string;
  batch_id: string;
  batch?: Batch;
  join_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  batch_id: string;
  batch?: Batch;
  date: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  student?: Student;
  status: AttendanceStatus;
  created_at: string;
}

export interface FeePlan {
  id: string;
  student_id: string;
  amount: number;
  frequency: FeeFrequency;
  due_day: number;
  created_at: string;
}

export interface FeePayment {
  id: string;
  student_id: string;
  student?: Student;
  amount: number;
  payment_date?: string;
  for_month: string;
  notes?: string;
  created_at: string;
}

export interface StudentWithStats extends Student {
  attendance_percentage: number;
  fee_status: FeeStatus;
  consecutive_absences: number;
  fee_plan?: FeePlan;
}

export interface DashboardStats {
  total_students: number;
  attendance_marked_today: boolean;
  sessions_today: number;
  fees_collected_this_month: number;
  fees_pending_this_month: number;
  fees_overdue_count: number;
  streak_days: number;
}
