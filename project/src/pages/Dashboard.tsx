import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
  Users, ClipboardCheck, Wallet, TrendingUp, ArrowRight,
  UserCheck, UserX, Calendar, Activity,
} from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeePayment, AttendanceRecord } from '@/lib/types';

interface DashboardStats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendancePercentage: number;
  totalCollected: number;
  totalPending: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [feeData, setFeeData] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [attendanceWeek, setAttendanceWeek] = useState<Array<{ day: string; present: number; absent: number; leave: number }>>([]);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; text: string; time: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const uid = user.id;

    const [studentsRes, attendanceRes, paymentsRes] = await Promise.all([
      supabase.from('students').select('*').eq('user_id', uid),
      supabase.from('attendance').select('*').eq('date', today).eq('user_id', uid),
      supabase.from('fee_payments').select('*').eq('user_id', uid),
    ]);

    const students = (studentsRes.data ?? []) as Student[];
    const todayAttendance = (attendanceRes.data ?? []) as AttendanceRecord[];
    const payments = (paymentsRes.data ?? []) as FeePayment[];

    const presentToday = todayAttendance.filter((a) => a.status === 'present').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'absent').length;
    const totalMarked = todayAttendance.length;
    const attendancePercentage = totalMarked > 0
      ? Math.round((presentToday / totalMarked) * 100)
      : 0;

    const totalCollected = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + (p.total_amount - p.amount_paid || 0), 0);

    setStats({
      totalStudents: students.length,
      presentToday,
      absentToday,
      attendancePercentage,
      totalCollected,
      totalPending,
    });

    setFeeData([
      { name: 'Collected', value: totalCollected, fill: '#15803d' },
      { name: 'Pending', value: totalPending, fill: '#84cc16' },
    ]);

    // Build weekly attendance data
    const weekData: Array<{ day: string; present: number; absent: number; leave: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayAttendance = await supabase.from('attendance').select('*').eq('date', dateStr).eq('user_id', uid);
      const records = (dayAttendance.data ?? []) as AttendanceRecord[];
      weekData.push({
        day: d.toLocaleDateString('en', { weekday: 'short' }),
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        leave: records.filter((r) => r.status === 'leave').length,
      });
    }
    setAttendanceWeek(weekData);

    // Recent activity
    const sorted = [...students].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 5);
    setRecentActivity(sorted.map((s) => ({
      id: s.id,
      text: `${s.name} was added to ${s.class} - ${s.section}`,
      time: new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    })));

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading || !stats) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'blue' },
    { label: 'Present Today', value: stats.presentToday, icon: UserCheck, color: 'green' },
    { label: 'Absent Today', value: stats.absentToday, icon: UserX, color: 'red' },
    { label: 'Attendance %', value: `${stats.attendancePercentage}%`, icon: Calendar, color: 'orange' },
    { label: 'Fees Collected', value: `₹${stats.totalCollected.toLocaleString('en-IN')}`, icon: Wallet, color: 'blue' },
    { label: 'Fees Pending', value: `₹${stats.totalPending.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'orange' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  };

  const quickCards = [
    { to: '/students', label: 'Students', desc: 'Manage student records', icon: Users },
    { to: '/attendance', label: 'Attendance', desc: 'Mark daily attendance', icon: ClipboardCheck },
    { to: '/fees', label: 'Fees', desc: 'Track fee payments', icon: Wallet },
    { to: '/reports', label: 'Reports', desc: 'View detailed reports', icon: Activity },
  ];

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your school's performance"
        action={
          <button onClick={handleRefresh} className="btn-secondary" disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      />

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[card.color]}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Fee collection pie chart */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fees Collection Summary</h3>
          {feeData.every((d) => d.value === 0) ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
              No fee data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={feeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {feeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly attendance graph */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Weekly Attendance</h3>
          {attendanceWeek.every((d) => d.present === 0 && d.absent === 0 && d.leave === 0) ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
              No attendance data for this week
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" />
                <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
                <Bar dataKey="leave" stackId="a" fill="#f97316" name="Leave" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick navigation + Recent activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Navigation</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickCards.map((card) => (
              <Link key={card.to} to={card.to} className="card group flex items-center gap-4 p-5 hover:-translate-y-0.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                  <card.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">{card.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{card.desc}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          <div className="card divide-y divide-gray-100 dark:divide-gray-800">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No recent activity</div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="p-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{activity.text}</p>
                  <p className="mt-1 text-xs text-gray-400">{activity.time}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
