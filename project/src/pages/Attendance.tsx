import { useEffect, useState, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Search, Calendar, Check, X, Clock, Filter } from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, AttendanceRecord } from '@/lib/types';

type Status = 'present' | 'absent' | 'leave';

export default function Attendance() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Status>>({});
  const [existingRecords, setExistingRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);
  const existingRecordsRef = useRef<Record<string, AttendanceRecord>>({});

  const loadStudents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('students').select('*').eq('user_id', user.id).order('name');
    setStudents((data ?? []) as Student[]);
    setLoading(false);
  }, [user]);

  const loadAttendance = useCallback(async (selectedDate: string) => {
    if (!user) return;
    const { data } = await supabase.from('attendance').select('*').eq('date', selectedDate).eq('user_id', user.id);
    const map: Record<string, AttendanceRecord> = {};
    const statusMap: Record<string, Status> = {};
    (data ?? []).forEach((r: AttendanceRecord) => {
      map[r.student_id] = r;
      statusMap[r.student_id] = r.status as Status;
    });
    setExistingRecords(map);
    existingRecordsRef.current = map;
    setAttendanceMap(statusMap);
  }, [user]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadAttendance(date); }, [date, loadAttendance]);

  const handleMark = async (studentId: string, status: Status) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));

    const existing = existingRecordsRef.current[studentId];
    if (existing) {
      if (existing.status !== status) {
        await supabase.from('attendance').update({ status }).eq('id', existing.id);
        existingRecordsRef.current = {
          ...existingRecordsRef.current,
          [studentId]: { ...existing, status },
        };
      }
    } else {
      const { data } = await supabase.from('attendance').insert({
        student_id: studentId,
        date,
        status,
      }).select().single();
      if (data) {
        existingRecordsRef.current = {
          ...existingRecordsRef.current,
          [studentId]: data as AttendanceRecord,
        };
      }
    }

    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 1500);
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.phone_number ?? '').includes(q);
    const matchesClass = !classFilter || s.class === classFilter;
    const matchesSection = !sectionFilter || s.section === sectionFilter;
    return matchesSearch && matchesClass && matchesSection;
  });

  const presentCount = Object.values(attendanceMap).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'absent').length;
  const leaveCount = Object.values(attendanceMap).filter((s) => s === 'leave').length;
  const unmarked = filtered.length - presentCount - absentCount - leaveCount;

  const pieData = [
    { name: 'Present', value: presentCount, fill: '#22c55e' },
    { name: 'Absent', value: absentCount, fill: '#ef4444' },
    { name: 'Leave', value: leaveCount, fill: '#f97316' },
    { name: 'Unmarked', value: unmarked, fill: '#d1d5db' },
  ];

  const barData = [
    { name: 'Present', count: presentCount },
    { name: 'Absent', count: absentCount },
    { name: 'Leave', count: leaveCount },
  ];

  const classOptions = [...new Set(students.map((s) => s.class))].sort();
  const sectionOptions = [...new Set(
    students.filter((s) => !classFilter || s.class === classFilter).map((s) => s.section)
  )].sort();

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        subtitle={`Mark attendance for ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {savedMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <Check className="h-4 w-4" />
          Attendance saved
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, roll number, email, phone..."
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-green-600"><Check className="h-5 w-5" /><span className="text-sm font-medium">Present</span></div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{presentCount}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-red-600"><X className="h-5 w-5" /><span className="text-sm font-medium">Absent</span></div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{absentCount}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-orange-500"><Clock className="h-5 w-5" /><span className="text-sm font-medium">Leave</span></div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{leaveCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium text-gray-500">Unmarked</div>
          <div className="mt-2 text-2xl font-bold text-gray-400">{unmarked}</div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance Distribution</h3>
          {pieData.every((d) => d.value === 0) ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance Summary</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {students.length === 0 ? 'No students yet. Add students first.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Student</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Adm. No</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Class</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((s) => {
                  const status = attendanceMap[s.id];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.admission_number}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.class} - {s.section}</td>
                      <td className="px-4 py-3 text-center">
                        {status ? <StatusBadge status={status} /> : <span className="text-xs text-gray-400">Not marked</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleMark(s.id, 'present')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${status === 'present' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900'}`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleMark(s.id, 'absent')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${status === 'absent' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900'}`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleMark(s.id, 'leave')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${status === 'leave' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900'}`}
                          >
                            Leave
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
