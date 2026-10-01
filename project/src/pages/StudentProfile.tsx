import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, GraduationCap, Users as UsersIcon,
  Wallet, ClipboardCheck, Calendar, Pencil, Trash2,
} from 'lucide-react';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import AddStudentModal from '@/components/AddStudentModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeeSetup, FeePayment, AttendanceRecord } from '@/lib/types';
import { UNITS } from '@/lib/constants';
import { calculateStudentFee, getOverallFeeStatus } from '@/lib/feeCalc';

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [feeSetups, setFeeSetups] = useState<FeeSetup[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const uid = user.id;
    const [studentRes, feeRes, paymentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).eq('user_id', uid).maybeSingle(),
      supabase.from('fee_setup').select('*').eq('user_id', uid),
      supabase.from('fee_payments').select('*').eq('student_id', id).eq('user_id', uid),
      supabase.from('attendance').select('*').eq('student_id', id).eq('user_id', uid).order('date', { ascending: false }),
    ]);
    setStudent(studentRes.data as Student | null);
    setFeeSetups((feeRes.data ?? []) as FeeSetup[]);
    setPayments((paymentsRes.data ?? []) as FeePayment[]);
    setAttendance((attendanceRes.data ?? []) as AttendanceRecord[]);
    setLoading(false);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!student) return;
    await supabase.from('students').delete().eq('id', student.id);
    navigate('/students');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!student) {
    return (
      <Layout>
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Student not found.</p>
          <Link to="/students" className="mt-4 inline-block btn-secondary">Back to Students</Link>
        </div>
      </Layout>
    );
  }

  const year = new Date().getFullYear();
  const feeData = calculateStudentFee(student, feeSetups, payments, year);
  const overallStatus = getOverallFeeStatus(feeData);
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const attendancePercentage = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  const infoItems = [
    { icon: User, label: 'Admission Number', value: student.admission_number },
    { icon: GraduationCap, label: 'Class', value: `${student.class} - ${student.section}${student.stream ? ` (${student.stream}${student.subject_group ? ` — ${student.subject_group}` : ''})` : ''}` },
    { icon: UsersIcon, label: "Father's Name", value: student.fathers_name || '—' },
    { icon: UsersIcon, label: "Mother's Name", value: student.mothers_name || '—' },
    { icon: Phone, label: 'Phone Number', value: student.phone_number || '—' },
    { icon: Mail, label: 'Email', value: student.email || '—' },
  ];

  return (
    <Layout>
      <Link to="/students" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Student info card */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950">
                <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{student.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{student.class} - {student.section}</p>
              </div>
            </div>

            <div className="space-y-4">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">{item.label}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Fee Category</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{student.fee_category}</div>
                </div>
              </div>
              {student.second_ward_discount && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  2nd Ward fee applied (second child — same parents)
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowEditModal(true)} className="btn-secondary flex-1">
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="card p-4">
              <ClipboardCheck className="mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{attendancePercentage}%</div>
              <div className="text-xs text-gray-500">Attendance</div>
            </div>
            <div className="card p-4">
              <Wallet className="mb-2 h-6 w-6 text-blue-600" />
              <div className="text-lg font-bold text-gray-900 dark:text-white"><StatusBadge status={overallStatus} /></div>
              <div className="mt-1 text-xs text-gray-500">Fee Status</div>
            </div>
          </div>
        </div>

        {/* Fee structure + attendance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fee structure */}
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fee Structure ({year})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Months</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Expected</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {feeData.units.map((u) => {
                    const unitInfo = UNITS.find((un) => un.number === u.unit);
                    return (
                      <tr key={u.unit}>
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{unitInfo?.label}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{unitInfo?.months}</td>
                        <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">₹{u.expected.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">₹{u.paid.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge status={u.status} /></td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{u.dueDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                    <td colSpan={2} className="px-3 py-3 font-bold text-gray-900 dark:text-white">Total</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900 dark:text-white">₹{feeData.totalExpected.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-right font-bold text-green-600">₹{feeData.totalPaid.toLocaleString('en-IN')}</td>
                    <td colSpan={2} className="px-3 py-3 text-right font-bold text-orange-500">Pending: ₹{feeData.totalPending.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Attendance history */}
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Attendance History</h3>
            {attendance.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No attendance records yet</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {attendance.slice(0, 30).map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                          <Calendar className="mr-2 inline h-4 w-4 text-gray-400" />
                          {new Date(a.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-3 py-2.5 text-center"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <AddStudentModal
          onClose={() => setShowEditModal(false)}
          onSaved={loadData}
          editingStudent={student}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Delete Student Permanently</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete {student.name} and all related records. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
