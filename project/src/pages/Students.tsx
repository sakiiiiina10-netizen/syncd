import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, AlertCircle, Filter } from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import AddStudentModal from '@/components/AddStudentModal';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeePayment, FeeSetup, AttendanceRecord } from '@/lib/types';
import { calculateStudentFee, getOverallFeeStatus } from '@/lib/feeCalc';

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeSetups, setFeeSetups] = useState<FeeSetup[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const uid = user.id;
    const [studentsRes, feeRes, paymentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('*').eq('user_id', uid).order('name'),
      supabase.from('fee_setup').select('*').eq('user_id', uid),
      supabase.from('fee_payments').select('*').eq('user_id', uid),
      supabase.from('attendance').select('*').eq('user_id', uid),
    ]);
    setStudents((studentsRes.data ?? []) as Student[]);
    setFeeSetups((feeRes.data ?? []) as FeeSetup[]);
    setPayments((paymentsRes.data ?? []) as FeePayment[]);
    setAttendanceRecords((attendanceRes.data ?? []) as AttendanceRecord[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const year = new Date().getFullYear();

  const enrichedStudents = useMemo(() => {
    return students.map((s) => {
      const studentPayments = payments.filter((p) => p.student_id === s.id);
      const feeData = calculateStudentFee(s, feeSetups, studentPayments, year);
      const studentAttendance = attendanceRecords.filter((a) => a.student_id === s.id);
      const presentCount = studentAttendance.filter((a) => a.status === 'present').length;
      const attendancePercentage = studentAttendance.length > 0
        ? Math.round((presentCount / studentAttendance.length) * 100)
        : 0;
      return {
        ...s,
        attendance_percentage: attendancePercentage,
        fee_status: getOverallFeeStatus(feeData),
        fee_summary: { total: feeData.totalExpected, paid: feeData.totalPaid, pending: feeData.totalPending },
      };
    });
  }, [students, feeSetups, payments, attendanceRecords, year]);

  const classOptions = useMemo(() =>
    [...new Set(students.map((s) => s.class))].sort(),
    [students]
  );

  const sectionOptions = useMemo(() =>
    [...new Set(
      students
        .filter((s) => !classFilter || s.class === classFilter)
        .map((s) => s.section)
    )].sort(),
    [students, classFilter]
  );

  const filtered = enrichedStudents.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.phone_number ?? '').includes(q);
    const matchesClass = !classFilter || s.class === classFilter;
    const matchesSection = !sectionFilter || s.section === sectionFilter;
    return matchesSearch && matchesClass && matchesSection;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('students').delete().eq('id', deleteId);
    setDeleteId(null);
    loadData();
  };

  return (
    <Layout>
      <PageHeader
        title="Students"
subtitle={`${filtered.length} of ${students.length} students${classFilter ? ` — ${classFilter}${sectionFilter ? ` (Section ${sectionFilter})` : ''}` : ''}`}
        action={
          <button onClick={() => { setEditingStudent(null); setShowModal(true); }} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
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

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {students.length === 0 ? 'No students yet. Click "Add Student" to get started.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Adm. No</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Class</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Section</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Attendance</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fee Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.email || s.phone_number || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.admission_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {s.class}
                      {s.stream && <span className="block text-xs text-gray-400">{s.stream}{s.subject_group ? ` (${s.subject_group})` : ''}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.section}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${s.attendance_percentage ?? 0 >= 75 ? 'text-green-600' : 'text-orange-500'}`}>
                        {s.attendance_percentage ?? 0}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.fee_status ?? 'unpaid'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/students/${s.id}`} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => { setEditingStudent(s); setShowModal(true); }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AddStudentModal
          onClose={() => setShowModal(false)}
          onSaved={loadData}
          editingStudent={editingStudent}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Student</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete the student and all related attendance and fee records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
