import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Wallet, Check, AlertCircle, Settings, Eye, Calendar,
} from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, FeeSetup, FeePayment } from '@/lib/types';
import { UNITS } from '@/lib/constants';
import { calculateStudentFee, getOverallFeeStatus, getDueDateForUnit } from '@/lib/feeCalc';

export default function Fees() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeSetups, setFeeSetups] = useState<FeeSetup[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<Student | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ student: Student; unit: number } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    const uid = user.id;
    const [studentsRes, feeRes, paymentsRes] = await Promise.all([
      supabase.from('students').select('*').eq('user_id', uid).order('name'),
      supabase.from('fee_setup').select('*').eq('user_id', uid),
      supabase.from('fee_payments').select('*').eq('user_id', uid),
    ]);
    setStudents((studentsRes.data ?? []) as Student[]);
    setFeeSetups((feeRes.data ?? []) as FeeSetup[]);
    setPayments((paymentsRes.data ?? []) as FeePayment[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const year = new Date().getFullYear();

  const enrichedStudents = useMemo(() => {
    return students.map((s) => {
      const studentPayments = payments.filter((p) => p.student_id === s.id);
      const feeData = calculateStudentFee(s, feeSetups, studentPayments, year);
      return {
        ...s,
        feeData,
        fee_status: getOverallFeeStatus(feeData),
      };
    });
  }, [students, feeSetups, payments, year]);

  const filtered = enrichedStudents.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.phone_number ?? '').includes(q);
    const matchesStatus = !statusFilter || s.fee_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCollected = enrichedStudents.reduce((sum, s) => sum + s.feeData.totalPaid, 0);
  const totalPending = enrichedStudents.reduce((sum, s) => sum + s.feeData.totalPending, 0);
  const totalExpected = enrichedStudents.reduce((sum, s) => sum + s.feeData.totalExpected, 0);

  return (
    <Layout>
      <PageHeader
        title="Fees"
        subtitle="Track fee collection and student payment status"
        action={
          <Link to="/fees/setup" className="btn-secondary">
            <Settings className="h-4 w-4" />
            Fee Setup
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalExpected.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-500">Total Expected</div>
        </div>
        <div className="card p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalCollected.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-500">Total Collected</div>
        </div>
        <div className="card p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950">
            <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalPending.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-500">Remaining</div>
        </div>
      </div>

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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input max-w-[180px]"
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="pending">Pending</option>
          <option value="unpaid">Unpaid</option>
        </select>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Class</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Pending</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.admission_number}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {s.class}
                      {s.stream && <span className="block text-xs text-gray-400">{s.stream}{s.subject_group ? ` (${s.subject_group})` : ''}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.fee_category}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₹{s.feeData.totalExpected.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">₹{s.feeData.totalPaid.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-500">₹{s.feeData.totalPending.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={s.fee_status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => setDetailModal(s)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                          title="View Fee Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Link to={`/students/${s.id}`} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950">
                          <Wallet className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailModal && (
        <FeeDetailModal
          student={detailModal}
          feeSetups={feeSetups}
          payments={payments.filter((p) => p.student_id === detailModal.id)}
          year={year}
          onClose={() => setDetailModal(null)}
          onRecordPayment={(unit) => {
            setDetailModal(null);
            setPaymentModal({ student: detailModal, unit });
          }}
        />
      )}

      {paymentModal && (
        <PaymentModal
          student={paymentModal.student}
          feeSetups={feeSetups}
          payments={payments.filter((p) => p.student_id === paymentModal.student.id)}
          year={year}
          initialUnit={paymentModal.unit}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); loadData(); }}
        />
      )}
    </Layout>
  );
}

// ============================================================
// Fee Detail Modal — shows per-unit breakdown with payment dates
// ============================================================
interface FeeDetailModalProps {
  student: Student;
  feeSetups: FeeSetup[];
  payments: FeePayment[];
  year: number;
  onClose: () => void;
  onRecordPayment: (unit: number) => void;
}

function FeeDetailModal({ student, feeSetups, payments, year, onClose, onRecordPayment }: FeeDetailModalProps) {
  const feeData = calculateStudentFee(student, feeSetups, payments, year);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fee Details</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {student.name} — {student.class}{student.stream ? ` (${student.stream}${student.subject_group ? ` — ${student.subject_group}` : ''})` : ''} — {student.fee_category}
            {student.second_ward_discount && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">2nd Ward</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Months</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Expected</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Payment Date</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Action</th>
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
                    <td className="px-3 py-3 text-right font-medium text-green-600">₹{u.paid.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      <Calendar className="mr-1 inline h-3.5 w-3.5 text-gray-400" />
                      {u.dueDate}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {u.paymentDate ? (
                        <span className="font-medium text-green-600">{u.paymentDate}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center"><StatusBadge status={u.status} /></td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => onRecordPayment(u.unit)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                      >
                        Record
                      </button>
                    </td>
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
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Payment Modal
// ============================================================
interface PaymentModalProps {
  student: Student;
  feeSetups: FeeSetup[];
  payments: FeePayment[];
  year: number;
  initialUnit: number;
  onClose: () => void;
  onSaved: () => void;
}

function PaymentModal({ student, feeSetups, payments, year, initialUnit, onClose, onSaved }: PaymentModalProps) {
  const existingPaymentForInit = payments.find((p) => p.unit_number === initialUnit && p.year === year);
  const [selectedUnit, setSelectedUnit] = useState(initialUnit);
  const [paymentAmount, setPaymentAmount] = useState(existingPaymentForInit?.amount_paid?.toString() ?? '');
  const [fineAmount, setFineAmount] = useState(existingPaymentForInit?.fine_paid?.toString() ?? '');
  const [paymentDate, setPaymentDate] = useState(existingPaymentForInit?.payment_date ?? new Date().toISOString().split('T')[0]);
  const [manualStatus, setManualStatus] = useState(existingPaymentForInit?.status ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feeData = calculateStudentFee(student, feeSetups, payments, year);
  const unitInfo = feeData.units.find((u) => u.unit === selectedUnit);
  const unitMeta = UNITS.find((u) => u.number === selectedUnit);
  const existingPayment = payments.find((p) => p.unit_number === selectedUnit && p.year === year);

  const computedStatus = (): string => {
    if (manualStatus) return manualStatus;
    const paid = parseFloat(paymentAmount) || 0;
    const fine = parseFloat(fineAmount) || 0;
    const totalExpected = unitInfo?.expected ?? 0;
    const totalWithFine = totalExpected + fine;
    if (totalExpected > 0 && paid >= totalWithFine) return 'paid';
    if (paid > 0) return 'partial';
    if (totalExpected > 0) return 'pending';
    return 'unpaid';
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const paid = parseFloat(paymentAmount) || 0;
    const fine = parseFloat(fineAmount) || 0;
    const totalExpected = unitInfo?.expected ?? 0;
    const status = computedStatus();

    const dueDate = unitInfo?.dueDate ?? getDueDateForUnit(selectedUnit, year);

    const payload = {
      student_id: student.id,
      unit_number: selectedUnit,
      year,
      amount_paid: paid,
      total_amount: totalExpected,
      fine_paid: fine,
      status,
      payment_date: paid > 0 ? paymentDate : null,
      due_date: dueDate,
      subject_group: student.subject_group,
    };

    let result;
    if (existingPayment) {
      result = await supabase.from('fee_payments').update(payload).eq('id', existingPayment.id);
    } else {
      result = await supabase.from('fee_payments').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record Payment</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {student.name} — {student.class}{student.stream ? ` (${student.stream}${student.subject_group ? ` — ${student.subject_group}` : ''})` : ''} — {student.fee_category}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="label">Select Unit</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {UNITS.map((u) => (
              <button
                key={u.number}
                onClick={() => {
                  setSelectedUnit(u.number);
                  const ep = payments.find((p) => p.unit_number === u.number && p.year === year);
                  setPaymentAmount(ep?.amount_paid?.toString() ?? '');
                  setFineAmount(ep?.fine_paid?.toString() ?? '');
                  setPaymentDate(ep?.payment_date ?? new Date().toISOString().split('T')[0]);
                  setManualStatus(ep?.status ?? '');
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  selectedUnit === u.number
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">{unitMeta?.months}</p>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Expected Amount</span>
            <span className="font-semibold text-gray-900 dark:text-white">₹{(unitInfo?.expected ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Already Paid</span>
            <span className="font-semibold text-green-600">₹{(unitInfo?.paid ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Due Date</span>
            <span className="font-semibold text-gray-900 dark:text-white">{unitInfo?.dueDate ?? '—'}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Current Status</span>
            <StatusBadge status={unitInfo?.status ?? 'unpaid'} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Payment Amount (₹)</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0"
              className="input"
            />
          </div>
          <div>
            <label className="label">Fine Amount (₹)</label>
            <input
              type="number"
              value={fineAmount}
              onChange={(e) => setFineAmount(e.target.value)}
              placeholder="0"
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Date of Payment</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Fee Status (override — leave as "Auto" to calculate from amount)</label>
            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setManualStatus('')}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  manualStatus === ''
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setManualStatus('paid')}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  manualStatus === 'paid'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setManualStatus('partial')}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  manualStatus === 'partial'
                    ? 'border-yellow-600 bg-yellow-50 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Partial
              </button>
              <button
                type="button"
                onClick={() => setManualStatus('pending')}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  manualStatus === 'pending'
                    ? 'border-orange-600 bg-orange-50 text-orange-700 dark:border-orange-500 dark:bg-orange-950 dark:text-orange-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setManualStatus('unpaid')}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                  manualStatus === 'unpaid'
                    ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Unpaid
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Selected: <StatusBadge status={computedStatus()} />
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : existingPayment ? 'Update Payment' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
