import { useEffect, useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeeSetup, FeePayment, AttendanceRecord } from '@/lib/types';
import { calculateStudentFee, getOverallFeeStatus } from '@/lib/feeCalc';
import { CLASSES } from '@/lib/constants';
import { Filter } from 'lucide-react';

export default function Analytics() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeSetups, setFeeSetups] = useState<FeeSetup[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    (async () => {
      const [s, fs, p, a] = await Promise.all([
        supabase.from('students').select('*').eq('user_id', uid),
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

  const classOptions = useMemo(() => [...new Set(students.map((s) => s.class))].sort(), [students]);
  const sectionOptions = useMemo(() =>
    [...new Set(students.filter((s) => !classFilter || s.class === classFilter).map((s) => s.section))].sort(),
    [students, classFilter]
  );

  const filteredStudents = useMemo(() =>
    students.filter((s) => (!classFilter || s.class === classFilter) && (!sectionFilter || s.section === sectionFilter)),
    [students, classFilter, sectionFilter]
  );

  const data = useMemo(() => {
    const filteredStudentIds = new Set(filteredStudents.map((s) => s.id));
    const filteredAttendance = attendance.filter((a) => filteredStudentIds.has(a.student_id));
    const filteredPayments = payments.filter((p) => filteredStudentIds.has(p.student_id));

    const presentCount = filteredAttendance.filter((a) => a.status === 'present').length;
    const absentCount = filteredAttendance.filter((a) => a.status === 'absent').length;
    const leaveCount = filteredAttendance.filter((a) => a.status === 'leave').length;
    const attendancePct = filteredAttendance.length > 0 ? Math.round((presentCount / filteredAttendance.length) * 100) : 0;

    const totalCollected = filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const totalPending = filteredPayments.reduce((sum, p) => sum + (p.total_amount - p.amount_paid || 0), 0);

    // Students per class (respect class filter — show only selected or all)
    const studentsForChart = classFilter ? filteredStudents : students;
    const studentsPerClass = CLASSES.map((c) => ({
      class: c.replace('Class ', 'C').replace('Pre-Nursery', 'PN').replace('Nursery', 'N'),
      count: studentsForChart.filter((s) => s.class === c).length,
    })).filter((d) => d.count > 0);

    // Fee status counts
    const feeStatusCounts = { paid: 0, partial: 0, pending: 0, unpaid: 0 };
    filteredStudents.forEach((s) => {
      const sPayments = filteredPayments.filter((p) => p.student_id === s.id);
      const feeData = calculateStudentFee(s, feeSetups, sPayments, year);
      const status = getOverallFeeStatus(feeData);
      feeStatusCounts[status as keyof typeof feeStatusCounts]++;
    });

    // Attendance trend (last 14 days)
    const trend: Array<{ day: string; attendance: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayAtt = filteredAttendance.filter((a) => a.date === dateStr);
      const dayPresent = dayAtt.filter((a) => a.status === 'present').length;
      const pct = dayAtt.length > 0 ? Math.round((dayPresent / dayAtt.length) * 100) : 0;
      trend.push({ day: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), attendance: pct });
    }

    return {
      presentCount, absentCount, leaveCount, attendancePct,
      totalCollected, totalPending, studentsPerClass, feeStatusCounts, trend,
    };
  }, [students, feeSetups, payments, attendance, year, filteredStudents]);

  const attendancePie = [
    { name: 'Present', value: data.presentCount, fill: '#22c55e' },
    { name: 'Absent', value: data.absentCount, fill: '#ef4444' },
    { name: 'Leave', value: data.leaveCount, fill: '#f97316' },
  ];

  const feesPie = [
    { name: 'Paid', value: data.feeStatusCounts.paid, fill: '#15803d' },
    { name: 'Partial', value: data.feeStatusCounts.partial, fill: '#3b82f6' },
    { name: 'Pending', value: data.feeStatusCounts.pending, fill: '#f97316' },
    { name: 'Unpaid', value: data.feeStatusCounts.unpaid, fill: '#84cc16' },
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
      <PageHeader title="Analytics" subtitle="Visual analytics for attendance, students, and fees" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }}
          className="input min-w-[140px]"
        >
          <option value="">All Classes</option>
          {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="input min-w-[100px]"
          disabled={!classFilter}
        >
          <option value="">All Sections</option>
          {sectionOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
        </select>
        {(classFilter || sectionFilter) && (
          <button
            onClick={() => { setClassFilter(''); setSectionFilter(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="text-xs text-gray-500">Total Students</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{filteredStudents.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500">Attendance Rate</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{data.attendancePct}%</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500">Total Collected</div>
          <div className="mt-1 text-2xl font-bold text-green-600">₹{data.totalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500">Total Pending</div>
          <div className="mt-1 text-2xl font-bold text-orange-500">₹{data.totalPending.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Attendance Analytics */}
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance Analytics</h3>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h4 className="mb-4 font-medium text-gray-700 dark:text-gray-300">Distribution</h4>
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
          <h4 className="mb-4 font-medium text-gray-700 dark:text-gray-300">14-Day Attendance Trend</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student Analytics */}
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Student Statistics</h3>
      <div className="mb-6 card p-6">
        <h4 className="mb-4 font-medium text-gray-700 dark:text-gray-300">Students per Class</h4>
        {data.studentsPerClass.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">No students yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.studentsPerClass}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Fee Analytics */}
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fee Analytics</h3>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h4 className="mb-4 font-medium text-gray-700 dark:text-gray-300">Fee Status Distribution</h4>
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
          <h4 className="mb-4 font-medium text-gray-700 dark:text-gray-300">Fees Statistics</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Collected</span>
              <span className="font-bold text-green-600">₹{data.totalCollected.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pending</span>
              <span className="font-bold text-orange-500">₹{data.totalPending.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Collection Rate</span>
              <span className="font-bold text-blue-600">
                {(data.totalCollected + data.totalPending) > 0
                  ? Math.round((data.totalCollected / (data.totalCollected + data.totalPending)) * 100)
                  : 0}%
              </span>
            </div>
            <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Fully Paid Students</span>
                <span className="font-bold text-gray-900 dark:text-white">{data.feeStatusCounts.paid}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Partially Paid</span>
                <span className="font-bold text-gray-900 dark:text-white">{data.feeStatusCounts.partial}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Pending / Unpaid</span>
                <span className="font-bold text-gray-900 dark:text-white">{data.feeStatusCounts.pending + data.feeStatusCounts.unpaid}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
