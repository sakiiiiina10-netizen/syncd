import { useEffect, useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { FileText, ClipboardCheck, Users, Wallet } from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeeSetup, FeePayment, AttendanceRecord } from '@/lib/types';
import { calculateStudentFee, getOverallFeeStatus } from '@/lib/feeCalc';

type Tab = 'attendance' | 'student' | 'fees';

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  const [students, setStudents] = useState<Student[]>([]);
  const [feeSetups, setFeeSetups] = useState<FeeSetup[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    (async () => {
      const [s, fs, p, a] = await Promise.all([
        supabase.from('students').select('*').eq('user_id', uid).order('name'),
        supabase.from('fee_setup').select('*').eq('user_id', uid),
        supabase.from('fee_payments').select('*').eq('user_id', uid),
        supabase.from('attendance').select('*').eq('user_id', uid),
      ]);
      setStudents((s.data ?? []) as Student[]);
      setFeeSetups((fs.data ?? []) as FeeSetup[]);
      setPayments((p.data ?? []) as FeePayment[]);
      setAttendance((a.data ?? []) as AttendanceRecord[]);
      setLoading(false);
    })();
  }, [user]);

  const year = new Date().getFullYear();

  const reportData = useMemo(() => {
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter((a) => a.status === 'present').length;
    const absentCount = attendance.filter((a) => a.status === 'absent').length;
    const leaveCount = attendance.filter((a) => a.status === 'leave').length;
    const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const studentRows = students.map((s) => {
      const sAttendance = attendance.filter((a) => a.student_id === s.id);
      const sPresent = sAttendance.filter((a) => a.status === 'present').length;
      const sPct = sAttendance.length > 0 ? Math.round((sPresent / sAttendance.length) * 100) : 0;
      const sPayments = payments.filter((p) => p.student_id === s.id);
      const feeData = calculateStudentFee(s, feeSetups, sPayments, year);
      return {
        ...s,
        attendancePct: sPct,
        feeStatus: getOverallFeeStatus(feeData),
        feeData,
      };
    });

    const totalCollected = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const totalExpected = studentRows.reduce((sum, s) => sum + s.feeData.totalExpected, 0);
    const totalPending = studentRows.reduce((sum, s) => sum + s.feeData.totalPending, 0);
    const feeStatusCounts = {
      paid: studentRows.filter((s) => s.feeStatus === 'paid').length,
      unpaid: studentRows.filter((s) => s.feeStatus === 'unpaid').length,
      pending: studentRows.filter((s) => s.feeStatus === 'pending').length,
      partial: studentRows.filter((s) => s.feeStatus === 'partial').length,
      completed: studentRows.filter((s) => s.feeStatus === 'completed').length,
    };

    return {
      totalAttendance, presentCount, absentCount, leaveCount, attendancePct,
      studentRows, totalCollected, totalExpected, totalPending, feeStatusCounts,
    };
  }, [students, feeSetups, payments, attendance, year]);

  const attendancePie = [
    { name: 'Present', value: reportData.presentCount, fill: '#22c55e' },
    { name: 'Absent', value: reportData.absentCount, fill: '#ef4444' },
    { name: 'Leave', value: reportData.leaveCount, fill: '#f97316' },
  ];

  const feesPie = [
    { name: 'Collected', value: reportData.totalCollected, fill: '#15803d' },
    { name: 'Pending', value: reportData.totalPending, fill: '#84cc16' },
  ];

  const tabs = [
    { id: 'attendance' as Tab, label: 'Attendance Report', icon: ClipboardCheck },
    { id: 'student' as Tab, label: 'Student Report', icon: Users },
    { id: 'fees' as Tab, label: 'Fees Report', icon: Wallet },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Reports" subtitle="Comprehensive reports for attendance, students, and fees" />

      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
              tab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Attendance Report */}
      {tab === 'attendance' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <div className="text-xs text-gray-500">Total Attendance Records</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{reportData.totalAttendance}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Present Count</div>
              <div className="mt-1 text-2xl font-bold text-green-600">{reportData.presentCount}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Absent Count</div>
              <div className="mt-1 text-2xl font-bold text-red-600">{reportData.absentCount}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Attendance Percentage</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">{reportData.attendancePct}%</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance Distribution</h3>
              {attendancePie.every((d) => d.value === 0) ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={attendancePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {attendancePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance Statistics</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendancePie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Student Report */}
      {tab === 'student' && (
        <div className="animate-fade-in">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Roll No</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Attendance</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Fee Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {reportData.studentRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No students yet</td></tr>
                  ) : reportData.studentRows.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.admission_number}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.phone_number || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${s.attendancePct >= 75 ? 'text-green-600' : 'text-orange-500'}`}>{s.attendancePct}%</span>
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={s.feeStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fees Report */}
      {tab === 'fees' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <div className="text-xs text-gray-500">Total Collection</div>
              <div className="mt-1 text-2xl font-bold text-green-600">₹{reportData.totalCollected.toLocaleString('en-IN')}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Remaining Collection</div>
              <div className="mt-1 text-2xl font-bold text-orange-500">₹{reportData.totalPending.toLocaleString('en-IN')}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Total Expected</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">₹{reportData.totalExpected.toLocaleString('en-IN')}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-gray-500">Collection Rate</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">
                {reportData.totalExpected > 0 ? Math.round((reportData.totalCollected / reportData.totalExpected) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fees Collection</h3>
              {feesPie.every((d) => d.value === 0) ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={feesPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {feesPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fee Status Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(reportData.feeStatusCounts).filter(([,v]) => v > 0).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-bold text-gray-900 dark:text-white">{count} students</span>
                  </div>
                ))}
                {Object.values(reportData.feeStatusCounts).every((v) => v === 0) && (
                  <p className="py-8 text-center text-sm text-gray-400">No fee data yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
